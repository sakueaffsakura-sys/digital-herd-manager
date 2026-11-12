/*
 * Arquivo de partida do aplicativo Node no cPanel.
 *
 * O cPanel usa o Phusion Passenger, que chama este arquivo e fica esperando um servidor subir.
 * O servidor de verdade é gerado pelo build (server/index.mjs) e sobe sozinho ao ser carregado.
 * Este arquivo só existe porque o Passenger pede um ponto de partida em CommonJS.
 */
process.env.NODE_ENV = process.env.NODE_ENV || "production";

// Quantos servidores da hospedagem ficam na frente do Node. No cPanel é um (o Apache/LiteSpeed).
// É o que permite descobrir o IP de verdade de quem acessa, para o controle de abuso funcionar.
process.env.PROXIES_CONFIAVEIS = process.env.PROXIES_CONFIAVEIS || "1";

import("./server/index.mjs").catch((erro) => {
  console.error("O site não subiu:", erro);
  process.exit(1);
});
