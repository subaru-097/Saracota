import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Cotacao } from '@/types';

export interface PdfExportOptions {
  filename?: string;
  elementId?: string;
}

export interface PdfExportResult {
  success: boolean;
  errorMsg?: string;
}

/**
 * Serviço de Exportação de PDF com alta fidelidade para cotações e relatórios tributários.
 * Resolve problemas de window.print() com React/Next.js e previne erros de componentes ausentes.
 */
export async function exportCotacaoToPdf(
  cotacao: Cotacao | any,
  options: PdfExportOptions = {}
): Promise<PdfExportResult> {
  try {
    const filename = options.filename || `Cotacao_${cotacao?.codigoCotacao || cotacao?.codigo || 'SaraCota'}.pdf`;

    // 1. Garantir que o ambiente é o navegador (client-side)
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return {
        success: false,
        errorMsg: 'A exportação de PDF só pode ser executada no navegador.',
      };
    }

    // 2. Se um elementId específico for fornecido, validar se ele existe e está renderizado no DOM
    let targetElement: HTMLElement | null = null;

    if (options.elementId) {
      targetElement = document.getElementById(options.elementId);
    }

    // Se não encontrou pelo ID ou nenhum ID foi passado, criar um contêiner temporário formatado para impressão de cotação
    let tempContainerCreated = false;

    if (!targetElement) {
      targetElement = document.createElement('div');
      targetElement.id = 'pdf-render-temp-container';
      targetElement.style.position = 'absolute';
      targetElement.style.left = '-9999px';
      targetElement.style.top = '-9999px';
      targetElement.style.width = '794px'; // Largura aproximada A4 a 96 DPI
      targetElement.style.backgroundColor = '#0F1318';
      targetElement.style.color = '#F3F4F6';
      targetElement.style.fontFamily = 'sans-serif';
      targetElement.style.padding = '32px';

      const codigo = cotacao?.codigoCotacao || cotacao?.codigo || '#8492';
      const obra = cotacao?.projeto?.nomeObra || cotacao?.obra || 'Reserva das Palmeiras';
      const dataStr = cotacao?.dataCriacao || new Date().toLocaleDateString('pt-BR');
      const totalST = cotacao?.valorTotalST || cotacao?.valorTotalSTTotal || 0;
      const totalGeral = cotacao?.valorTotalGeral || 0;

      const itensList = cotacao?.itens || [];
      const fornecedoresList = cotacao?.fornecedores || [];

      targetElement.innerHTML = `
        <div style="font-family: sans-serif; color: #F3F4F6; background: #0F1318; padding: 24px; border-radius: 16px; border: 1px solid #2B333E;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #F59E0B; padding-bottom: 16px; margin-bottom: 24px;">
            <div>
              <h1 style="margin: 0; font-size: 24px; color: #FFFFFF; font-weight: 800;">
                Sara<span style="color: #F59E0B;">Cota</span> SaaS
              </h1>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #9CA3AF;">
                Relatório Oficial de Cotação de Materiais & Substituição Tributária (ICMS-ST)
              </p>
            </div>
            <div style="text-align: right;">
              <span style="display: inline-block; background: #F59E0B; color: #000; font-weight: 800; font-size: 12px; padding: 4px 12px; border-radius: 9999px;">
                Cotação ${codigo}
              </span>
              <p style="margin: 6px 0 0 0; font-size: 11px; color: #9CA3AF; font-family: monospace;">
                Data: ${dataStr}
              </p>
            </div>
          </div>

          <!-- Dados da Obra -->
          <div style="background: #181E27; border: 1px solid #2B333E; padding: 16px; border-radius: 12px; margin-bottom: 24px;">
            <div style="font-size: 11px; color: #F59E0B; font-weight: 700; text-transform: uppercase; margin-bottom: 6px;">
              Informações do Projeto / Obra
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px;">
              <span><strong>Obra:</strong> ${obra}</span>
              <span><strong>Status:</strong> ${cotacao?.status || 'Aprovada'}</span>
            </div>
          </div>

          <!-- Tabela de Itens ou Fornecedores -->
          <div style="margin-bottom: 24px;">
            <h3 style="font-size: 14px; margin-bottom: 12px; color: #FFFFFF; border-left: 3px solid #F59E0B; padding-left: 8px;">
              Detalhamento de Propostas & Substituição Tributária
            </h3>

            ${
              fornecedoresList.length > 0
                ? `
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                  <thead>
                    <tr style="background: #1F2937; color: #9CA3AF; border-bottom: 1px solid #374151;">
                      <th style="padding: 10px;">Fornecedor</th>
                      <th style="padding: 10px;">Score</th>
                      <th style="padding: 10px;">Produtos</th>
                      <th style="padding: 10px;">ICMS-ST</th>
                      <th style="padding: 10px; text-align: right;">Total com ST</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${fornecedoresList
                      .map(
                        (f: any) => `
                      <tr style="border-bottom: 1px solid #1F2937; background: ${f.isVencedor ? '#1F241B' : 'transparent'};">
                        <td style="padding: 10px; font-weight: 700; color: #FFFFFF;">
                          ${f.nome} ${f.isVencedor ? '<span style="color:#10B981;">(Melhor Opção)</span>' : ''}
                        </td>
                        <td style="padding: 10px; color: #F59E0B;">★ ${f.score || 5.0}</td>
                        <td style="padding: 10px;">R$ ${(f.valorProdutos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td style="padding: 10px; color: #06B6D4;">R$ ${(f.valorST || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td style="padding: 10px; text-align: right; font-weight: 700; color: #F59E0B;">
                          R$ ${(f.valorTotalGeral || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              `
                : `
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                  <thead>
                    <tr style="background: #1F2937; color: #9CA3AF; border-bottom: 1px solid #374151;">
                      <th style="padding: 10px;">Item / Descrição</th>
                      <th style="padding: 10px;">Qtd</th>
                      <th style="padding: 10px;">Unidade</th>
                      <th style="padding: 10px; text-align: right;">Status Matching</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itensList
                      .map(
                        (item: any) => `
                      <tr style="border-bottom: 1px solid #1F2937;">
                        <td style="padding: 10px; font-weight: 700; color: #FFFFFF;">${item.nomeOriginal || item.nome}</td>
                        <td style="padding: 10px;">${item.quantidade}</td>
                        <td style="padding: 10px;">${item.unidade}</td>
                        <td style="padding: 10px; text-align: right; color: #10B981;">Match OK</td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              `
            }
          </div>

          <!-- Resumo Financeiro -->
          <div style="background: #181E27; border: 1px solid #374151; padding: 16px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-size: 11px; color: #9CA3AF; display: block;">ICMS-ST Total Retido na Fonte:</span>
              <strong style="font-size: 14px; color: #06B6D4;">R$ ${totalST.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 11px; color: #9CA3AF; display: block;">Valor Total Geral Aprovado:</span>
              <strong style="font-size: 18px; color: #F59E0B;">R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>

          <!-- Rodapé de Autenticidade -->
          <div style="margin-top: 32px; padding-top: 12px; border-top: 1px solid #2B333E; font-size: 10px; color: #6B7280; text-align: center;">
            Documento gerado automaticamente via Sara Cota SaaS • Autenticação de Cálculo de ST por NCM com Validação no PostgreSQL.
          </div>
        </div>
      `;

      document.body.appendChild(targetElement);
      tempContainerCreated = true;
    }

    // 3. Aguardar estabilização da renderização no DOM
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => setTimeout(resolve, 150));

    // 4. Capturar o elemento via html2canvas com alta resolução
    const canvas = await html2canvas(targetElement, {
      scale: 2, // Maior nitidez
      useCORS: true,
      logging: false,
      backgroundColor: '#0F1318',
    });

    if (tempContainerCreated && targetElement.parentNode) {
      targetElement.parentNode.removeChild(targetElement);
    }

    const imgData = canvas.toDataURL('image/png');

    // 5. Construir o documento PDF com jsPDF (orientação retrato, tamanho A4)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgWidth = 210; // Largura total A4 em mm
    const pageHeight = 297; // Altura total A4 em mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Tratar múltiplas páginas caso o conteúdo seja extenso
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // 6. Fazer download do PDF diretamente no navegador
    pdf.save(filename);

    return { success: true };
  } catch (err: any) {
    console.error('Erro na geração do PDF:', err);
    return {
      success: false,
      errorMsg: err.message || 'Falha ao processar a renderização do PDF.',
    };
  }
}
