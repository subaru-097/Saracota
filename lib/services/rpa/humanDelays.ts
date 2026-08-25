/**
 * Módulo de Delays Realistas Humano-Simulados para Automação RPA
 */

export async function delayRandom(minMs: number, maxMs: number): Promise<number> {
  const delayMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return delayMs;
}

/**
 * Simula digitação humana caractere por caractere com intervalo dinâmico (300ms a 1500ms)
 */
export async function simulateHumanTyping(
  text: string,
  onCharTyped?: (charIndex: number, delayAppliedMs: number) => void,
  minMs: number = 50,
  maxMs: number = 200
): Promise<number> {
  let totalTime = 0;
  for (let i = 0; i < text.length; i++) {
    const delay = await delayRandom(minMs, maxMs);
    totalTime += delay;
    if (onCharTyped) {
      onCharTyped(i, delay);
    }
  }
  return totalTime;
}

/**
 * Simula pausa realista pré e pós clique de ação (1.0s a 3.0s)
 */
export async function simulateHumanActionDelay(
  actionName: string,
  minMs: number = 1000,
  maxMs: number = 3000
): Promise<number> {
  return await delayRandom(minMs, maxMs);
}
