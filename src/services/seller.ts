import { prisma } from '../database/client.js';
import type { Seller } from '@prisma/client';

/**
 * Busca todos os vendedores ativos
 */
export async function getActiveSellers(): Promise<Seller[]> {
  return prisma.seller.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
}

/**
 * Busca vendedor por ID
 */
export async function getSellerById(id: string): Promise<Seller | null> {
  return prisma.seller.findUnique({
    where: { id },
  });
}

/**
 * Busca vendedor por email
 */
export async function getSellerByEmail(email: string): Promise<Seller | null> {
  return prisma.seller.findUnique({
    where: { email },
  });
}

/**
 * Cria um novo vendedor
 */
export async function createSeller(data: {
  name: string;
  email: string;
  phone?: string;
  calendarId: string;
}): Promise<Seller> {
  return prisma.seller.create({ data });
}

/**
 * Atualiza um vendedor
 */
export async function updateSeller(
  id: string,
  data: Partial<{
    name: string;
    email: string;
    phone: string;
    calendarId: string;
    isActive: boolean;
  }>
): Promise<Seller> {
  return prisma.seller.update({
    where: { id },
    data,
  });
}

/**
 * Desativa um vendedor (soft delete)
 */
export async function deactivateSeller(id: string): Promise<Seller> {
  return prisma.seller.update({
    where: { id },
    data: { isActive: false },
  });
}
