import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Remove acentos de uma string para comparacao flexivel
 * "Niterói" -> "niteroi", "São Paulo" -> "sao paulo"
 */
function normalizeString(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

interface IBGEMunicipio {
  id: number;
  nome: string;
  microrregiao: {
    mesorregiao: {
      UF: {
        sigla: string;
        nome: string;
      };
    };
  };
}

interface SIDRAPopulacao {
  V: string; // Valor da população
  D1N: string; // Nome do município
  D2N: string; // Ano
}

export const getCityPopulationTool = tool(
  async ({ city, state }) => {
    try {
      const cityNormalized = normalizeString(city);
      const stateNormalized = state.trim().toUpperCase();

      // 1. Busca o município na API de localidades do IBGE
      const localidadesUrl = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateNormalized}/municipios`;
      const localidadesRes = await fetch(localidadesUrl);

      if (!localidadesRes.ok) {
        return JSON.stringify({
          success: false,
          error: `Estado "${state}" nao encontrado.`,
        });
      }

      const municipios: IBGEMunicipio[] = await localidadesRes.json();

      // Encontra o município pelo nome (busca flexível, ignora acentos)
      const municipio = municipios.find(
        (m) => normalizeString(m.nome) === cityNormalized
      );

      if (!municipio) {
        // Tenta busca parcial (também sem acentos)
        const municipioParcial = municipios.find((m) =>
          normalizeString(m.nome).includes(cityNormalized)
        );

        if (!municipioParcial) {
          return JSON.stringify({
            success: false,
            error: `Municipio "${city}" nao encontrado em ${state}.`,
            sugestao:
              "Verifique a grafia do nome do municipio ou tente sem acentos.",
          });
        }

        // Usa o encontrado parcialmente
        return await fetchPopulation(municipioParcial);
      }

      return await fetchPopulation(municipio);
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Erro ao buscar populacao: ${error.message}`,
      });
    }
  },
  {
    name: "get_city_population",
    description:
      "Busca a quantidade de habitantes de um municipio brasileiro usando dados oficiais do IBGE. " +
      "Use para contextualizar o atendimento baseado no tamanho da cidade do cliente.",
    schema: z.object({
      city: z
        .string()
        .describe("Nome do municipio (exemplo: Londrina, Sao Paulo, Curitiba)"),
      state: z
        .string()
        .describe("Sigla do estado com 2 letras (exemplo: PR, SP, RJ)"),
    }),
  }
);

async function fetchPopulation(municipio: IBGEMunicipio): Promise<string> {
  const codigoMunicipio = municipio.id;
  const uf = municipio.microrregiao.mesorregiao.UF;

  // 2. Busca população na API SIDRA - Tabela 6579 (Estimativas de população)
  // n6 = nível municipal, p/last = último período disponível
  const sidraUrl = `https://apisidra.ibge.gov.br/values/t/6579/n6/${codigoMunicipio}/v/9324/p/last`;
  const sidraRes = await fetch(sidraUrl);

  if (!sidraRes.ok) {
    return JSON.stringify({
      success: true,
      city: municipio.nome,
      state: uf.sigla,
      stateName: uf.nome,
      population: null,
      message: `Municipio encontrado: ${municipio.nome}/${uf.sigla}, mas nao foi possivel obter a populacao.`,
    });
  }

  const sidraData: SIDRAPopulacao[] = await sidraRes.json();

  // O primeiro item é o header, os dados começam no índice 1
  if (sidraData.length < 2) {
    return JSON.stringify({
      success: true,
      city: municipio.nome,
      state: uf.sigla,
      stateName: uf.nome,
      population: null,
      message: `Municipio encontrado: ${municipio.nome}/${uf.sigla}, mas dados de populacao nao disponiveis.`,
    });
  }

  const dadosPopulacao = sidraData[1];
  const populacao = parseInt(dadosPopulacao.V, 10);
  const anoReferencia = dadosPopulacao.D2N;

  // Formata a população com separador de milhares
  const populacaoFormatada = populacao.toLocaleString("pt-BR");

  return JSON.stringify({
    success: true,
    city: municipio.nome,
    state: uf.sigla,
    stateName: uf.nome,
    population: populacao,
    populationFormatted: populacaoFormatada,
    referenceYear: anoReferencia,
    message: `${municipio.nome}/${uf.sigla} tem aproximadamente ${populacaoFormatada} habitantes (estimativa ${anoReferencia}).`,
  });
}
