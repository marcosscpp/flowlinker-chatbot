import axios from "axios";

const api = axios.create({
  baseURL: "https://chatbot-server-4jio.onrender.com/api/dashboard",
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
