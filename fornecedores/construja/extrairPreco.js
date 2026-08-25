async function extrairPreco(page) {
  const inteiro = await page.locator('.Produto_precoProdutoInteger__u_7rK').first().innerText();
  const decimalRaw = await page.locator('.Produto_precoProdutoDecimal__WX_3c').first().innerText();
  const decimal = decimalRaw.trim().replace(',', '').slice(0, 2);
  const preco = parseFloat(`${inteiro.trim()}.${decimal}`);
  return preco;
}

module.exports = { extrairPreco };
