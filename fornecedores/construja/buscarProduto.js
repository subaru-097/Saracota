const { extrairPreco } = require('./extrairPreco');

async function buscarProduto(page, nomeProduto, quantidade = 1) {
  await page.fill('input[name="search"]', nomeProduto);
  await page.click('svg path[d*="M416 208"]');
  await page.waitForTimeout(2000);

  const preco = await extrairPreco(page);

  const inputQtd = page.locator('input.QuantidadeMaisMenos_input__grKxO').first();
  await inputQtd.fill(String(quantidade));
  await page.click('svg path[d*="M0 24C0 10.7"]');
  await page.waitForTimeout(1000);
  await page.click('button:text("Ver carrinho")');
  await page.waitForTimeout(2000);

  return {
    produto: nomeProduto,
    quantidade,
    preco,
    prazo: null,
    formaPagamento: null
  };
}

module.exports = { buscarProduto };
