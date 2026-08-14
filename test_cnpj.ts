import { buscarCnpj } from './src/services/brasil-api/client';

async function run() {
  console.log(await buscarCnpj('29.563.201/0001-89'));
}
run();