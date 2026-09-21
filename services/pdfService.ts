import { getLocalIsoDate, formatLocalDate } from '../utils/dateUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SettlementRecord, Unit, Consortium, Payment, ConsortiumSettings } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// --- UTILIDADES ---

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { 
      style: 'currency', 
      currency: 'ARS', 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
  }).format(amount || 0);
};

export const formatDate = (isoString: string) => {
    if (!isoString) return '';
    let dateStr = isoString;
    if (dateStr.length === 10) {
        dateStr += 'T12:00:00Z';
    }
    const d = new Date(dateStr);
    return format(d, 'dd/MM/yyyy', { locale: es });
};

// PALETA DE COLORES CORPORATIVA
const THEME = {
    primary: [30, 58, 138] as [number, number, number],   // Azul Institucional
    secondary: [71, 85, 105] as [number, number, number], // Gris Pizarra
    stripe: [241, 245, 249] as [number, number, number],  // Fondo cebra tablas
    border: [203, 213, 225] as [number, number, number],  // Bordes
    text: [30, 41, 59] as [number, number, number]        // Texto principal
};

// --- HELPERS DE DIBUJO ---

function drawHeader(doc: jsPDF, consortium: Consortium, title: string, settlement: SettlementRecord) {
    const pageWidth = doc.internal.pageSize.width;
    
    // Fondo azul superior
    doc.setFillColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.rect(0, 0, pageWidth, 38, 'F');
    doc.setTextColor(255, 255, 255);
    
    if (consortium.image) { 
        try { doc.addImage(consortium.image, 'JPEG', 14, 8, 22, 22); } catch (e) { } 
        doc.setFontSize(18); 
        doc.setFont("helvetica", "bold"); 
        doc.text((consortium.name || "CONSORCIO").toUpperCase(), 42, 16);
        
        doc.setFontSize(10); 
        doc.setFont("helvetica", "normal"); 
        doc.text(consortium.address || "", 42, 22);
        
        if (consortium.cuit) {
            doc.text(`CUIT: ${consortium.cuit}`, 42, 27);
        }
    } else {
        doc.setFontSize(18); 
        doc.setFont("helvetica", "bold"); 
        doc.text((consortium.name || "CONSORCIO").toUpperCase(), 14, 16);
        
        doc.setFontSize(10); 
        doc.setFont("helvetica", "normal"); 
        doc.text(consortium.address || "", 14, 22);
        
        if (consortium.cuit) {
            doc.text(`CUIT: ${consortium.cuit}`, 14, 27);
        }
    }

    // Título a la derecha
    doc.setFontSize(12); 
    doc.setFont("helvetica", "bold"); 
    doc.text(title, pageWidth - 14, 18, { align: 'right' });
    
    doc.setFontSize(11); 
    doc.setFont("helvetica", "normal"); 
    doc.text(`Período: ${(settlement.month || '-').toUpperCase()}`, pageWidth - 14, 26, { align: 'right' });
}

function drawFooter(doc: jsPDF, settlement: SettlementRecord, pageWidth: number, yPos: number) {
    doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]); 
    doc.line(14, yPos, pageWidth - 14, yPos); 
    yPos += 8;
    
    doc.setFontSize(10); 
    doc.setFont("helvetica", "bold"); 
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]); 
    doc.text("VENCIMIENTOS:", 14, yPos);
    
    doc.setFont("helvetica", "normal"); 
    doc.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
    
    const vto1 = settlement.firstExpirationDate ? formatDate(settlement.firstExpirationDate) : '-';
    const vto2 = settlement.secondExpirationDate ? formatDate(settlement.secondExpirationDate) : '-';
    
    doc.text(`1° Vencimiento: ${vto1}`, 50, yPos); 
    doc.text(`2° Vencimiento: ${vto2}`, 110, yPos);
    
    if (settlement.couponMessage) {
        yPos += 8; 
        doc.setFontSize(9); 
        doc.setFont("helvetica", "italic"); 
        doc.setTextColor(THEME.secondary[0], THEME.secondary[1], THEME.secondary[2]);
        doc.text(`Aviso: ${settlement.couponMessage}`, 14, yPos, { maxWidth: pageWidth - 28 });
    }
}

function addPageNumbers(doc: jsPDF) {
    const pageCount = doc.getNumberOfPages(); 
    const pageWidth = doc.internal.pageSize.width; 
    const pageHeight = doc.internal.pageSize.height;
    
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i); 
        doc.setFontSize(8); 
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    }
}

// --- GENERADOR CUPÓN INDIVIDUAL ITEMIZADO (REDISEÑADO A 1 PÁGINA) ---


export const normalizePeriod = (str: string) => {
    return (str || '')
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\bde\b/g, '')
        .replace(/\bdel\b/g, '')
        .replace(/\bborrador\b/g, '')
        .replace(/\bvista previa\b/g, '')
        .replace(/[-/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

export const isCurrentPeriodDebt = (debtPeriod: string, settlementMonth: string) => {
    const p1 = normalizePeriod(debtPeriod);
    const p2 = normalizePeriod(settlementMonth);
    
    // Si coinciden los períodos normalizados
    if (p1 && p2 && p1 === p2) return true;

    // Si el settlementMonth dice BORRADOR o está vacío, comparamos contra el mes actual del sistema
    const currentSystemMonth = normalizePeriod(new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' }));
    if ((!p2 || (settlementMonth || '').toUpperCase().includes('BORRADOR')) && p1 === currentSystemMonth) {
        return true;
    }

    return false;
};

const createCouponDoc = (settlement: SettlementRecord, unit: Unit, consortium: Consortium, settings: ConsortiumSettings, allUnitsData: Unit[]) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let finalY = 20;

    // Helper para normalizar el porcentaje global de todo el consorcio
    const totalGlobalProrate = allUnitsData.reduce((sum, u) => sum + (Number(u.proratePercentage) || 0), 0) || 100;
    const globalProrateRatio = Number(unit.proratePercentage || 0) / totalGlobalProrate;
    const formattedPercentage = Number(unit.proratePercentage || 0).toFixed(4);

    // Encabezado institucional (ocupa 0 a 34 mm)
    const headerHeight = 34;
    doc.setFillColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');
    doc.setTextColor(255, 255, 255);
    
    if (consortium.image) { 
        try { doc.addImage(consortium.image, 'JPEG', 14, 6, 22, 22); } catch (e) { } 
        doc.setFontSize(16); 
        doc.setFont("helvetica", "bold"); 
        doc.text((consortium.name || "CONSORCIO").toUpperCase(), 40, 14);
        
        doc.setFontSize(9); 
        doc.setFont("helvetica", "normal"); 
        doc.text(consortium.address || "", 40, 20);
        
        if (consortium.cuit) {
            doc.text(`CUIT: ${consortium.cuit}`, 40, 25);
        }
    } else {
        doc.setFontSize(16); 
        doc.setFont("helvetica", "bold"); 
        doc.text((consortium.name || "CONSORCIO").toUpperCase(), 14, 14);
        
        doc.setFontSize(9); 
        doc.setFont("helvetica", "normal"); 
        doc.text(consortium.address || "", 14, 20);
        
        if (consortium.cuit) {
            doc.text(`CUIT: ${consortium.cuit}`, 14, 25);
        }
    }

    // Título a la derecha
    doc.setFontSize(11); 
    doc.setFont("helvetica", "bold"); 
    doc.text("CUPÓN DE PAGO INDIVIDUAL", pageWidth - 14, 15, { align: 'right' });
    
    doc.setFontSize(10); 
    doc.setFont("helvetica", "normal"); 
    doc.text(`Período: ${(settlement.month || '-').toUpperCase()}`, pageWidth - 14, 23, { align: 'right' });

    finalY = 38;

    // Ficha informativa de la Unidad Funcional (compacta: 20 mm)
    doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
    doc.setFillColor(250, 250, 252);
    doc.roundedRect(14, finalY, pageWidth - 28, 20, 2, 2, 'FD');
    
    // Unidad y Propietario
    doc.setFontSize(13);
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.setFont("helvetica", "bold");
    doc.text(`Unidad: ${unit.unitNumber || '-'}`, 20, finalY + 8);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
    doc.text(`Propietario: ${unit.ownerName || 'A designar'}`, 20, finalY + 15);

    // Sector / Complejo si existe
    if (unit.block) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(67, 56, 202);
        doc.text(`SECTOR: ${unit.block.toUpperCase()}`, 80, finalY + 8);
    }

    // Estado de ocupación / Fondo de Reserva
    const participatesInReserve = unit.contributesToReserve !== false && unit.isOccupied !== false;
    if (!participatesInReserve) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(180, 83, 9);
        doc.text(`[DESOCUPADO / EXENTO FONDO DE RESERVA]`, 80, finalY + 15);
    }

    // Prorrateo Base a la derecha
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(THEME.secondary[0], THEME.secondary[1], THEME.secondary[2]);
    doc.text("PRORRATEO BASE", pageWidth - 20, finalY + 7.5, { align: 'right' });
    
    doc.setFontSize(12);
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.setFont("helvetica", "bold");
    doc.text(`${formattedPercentage}%`, pageWidth - 20, finalY + 16, { align: 'right' });

    finalY = 62;

    // --- PROCESAMIENTO Y SEPARACIÓN DE GASTOS (ORDINARIOS Y EXTRAORDINARIOS) ---
    const allExpenses = settlement.snapshotExpenses || [];
    
    let sumOrdinary = 0;
    let sumExtraordinary = 0;
    let calculatedExpensesSum = 0;

    const ordinaryRows: any[][] = [];
    const extraordinaryRows: any[][] = [];

    allExpenses.forEach(exp => {
        let unitAmount = 0;
        let distributionLabel = '';

        if (exp.distributionType === 'FROM_RESERVE') {
            unitAmount = 0;
            distributionLabel = 'Fondo Reserva (Sin Cargo)';
        } else {
            if (exp.affectedUnitIds && exp.affectedUnitIds.length > 0) {
                if (!exp.affectedUnitIds.includes(unit.id)) return; // No afecta a esta unidad
                
                if (exp.distributionType === 'EQUAL_PARTS') {
                    unitAmount = exp.amount / exp.affectedUnitIds.length;
                    distributionLabel = `Partes Iguales (${exp.affectedUnitIds.length} UF)`;
                } else {
                    const affectedUnitsData = allUnitsData.filter(u => exp.affectedUnitIds!.includes(u.id));
                    const totalAffectedProrate = affectedUnitsData.reduce((sum, u) => sum + (Number(u.proratePercentage) || 0), 0) || 100;
                    unitAmount = exp.amount * (Number(unit.proratePercentage || 0) / totalAffectedProrate);
                    distributionLabel = `Prorrateo Normalizado`;
                }
            } else {
                if (exp.distributionType === 'EQUAL_PARTS') {
                    unitAmount = exp.amount / (allUnitsData.length || 1);
                    distributionLabel = 'Partes Iguales';
                } else {
                    unitAmount = exp.amount * globalProrateRatio;
                    distributionLabel = `Prorrateo ${formattedPercentage}%`;
                }
            }
        }

        calculatedExpensesSum += unitAmount;

        const rowItem = [
            exp.description,
            formatCurrency(exp.amount),
            distributionLabel,
            formatCurrency(unitAmount)
        ];

        if (exp.category === 'Ordinary') {
            sumOrdinary += unitAmount;
            ordinaryRows.push(rowItem);
        } else {
            sumExtraordinary += unitAmount;
            extraordinaryRows.push(rowItem);
        }
    });

    const bodyRows: any[][] = [];

    // 1. SECCIÓN GASTOS ORDINARIOS
    if (ordinaryRows.length > 0) {
        bodyRows.push([
            { 
                content: '1. GASTOS ORDINARIOS', 
                colSpan: 4, 
                styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: THEME.primary, fontSize: 8 } 
            }
        ]);
        ordinaryRows.forEach(r => bodyRows.push(r));
        bodyRows.push([
            { content: 'SUBTOTAL EXPENSAS ORDINARIAS', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fontSize: 8, textColor: THEME.primary } },
            { content: formatCurrency(sumOrdinary), styles: { fontStyle: 'bold', halign: 'right', fontSize: 8, textColor: THEME.primary } }
        ]);
    }

    // 2. SECCIÓN GASTOS EXTRAORDINARIOS
    if (extraordinaryRows.length > 0) {
        bodyRows.push([
            { 
                content: '2. GASTOS EXTRAORDINARIOS', 
                colSpan: 4, 
                styles: { fontStyle: 'bold', fillColor: [254, 243, 199], textColor: [180, 83, 9], fontSize: 8 } 
            }
        ]);
        extraordinaryRows.forEach(r => bodyRows.push(r));
        bodyRows.push([
            { content: 'SUBTOTAL EXPENSAS EXTRAORDINARIAS', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fontSize: 8, textColor: [180, 83, 9] } },
            { content: formatCurrency(sumExtraordinary), styles: { fontStyle: 'bold', halign: 'right', fontSize: 8, textColor: [180, 83, 9] } }
        ]);
    }

    // 3. SECCIÓN FONDO DE RESERVA (Mismo % para todos sobre sus expensas ordinarias)
    let reserveContributionForUnit = 0;

    if (participatesInReserve && (settings.monthlyReserveContributionPercentage || 0) > 0 && sumOrdinary > 0) {
        // El porcentaje es el mismo para todos aplicado a las expensas ordinarias de la unidad
        reserveContributionForUnit = (sumOrdinary * settings.monthlyReserveContributionPercentage) / 100;

        bodyRows.push([
            { 
                content: '3. FONDO DE RESERVA', 
                colSpan: 4, 
                styles: { fontStyle: 'bold', fillColor: [236, 253, 245], textColor: [4, 120, 87], fontSize: 8 } 
            }
        ]);
        bodyRows.push([
            `Aporte Mensual (${settings.monthlyReserveContributionPercentage}% sobre Ordinarias)`,
            formatCurrency(sumOrdinary),
            `${settings.monthlyReserveContributionPercentage}% directo`,
            formatCurrency(reserveContributionForUnit)
        ]);
        bodyRows.push([
            { content: 'SUBTOTAL APORTE FONDO DE RESERVA', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fontSize: 8, textColor: [4, 120, 87] } },
            { content: formatCurrency(reserveContributionForUnit), styles: { fontStyle: 'bold', halign: 'right', fontSize: 8, textColor: [4, 120, 87] } }
        ]);

        calculatedExpensesSum += reserveContributionForUnit;
    }

    const detail = (settlement.unitDetails || []).find(d => d.unitId === unit.id);
    const exactAmountToPayMonth = detail ? detail.totalToPay : calculatedExpensesSum;

    // Pequeño ajuste técnico por redondeo de decimales si existiera
    const diff = exactAmountToPayMonth - calculatedExpensesSum;
    if (Math.abs(diff) > 0.05) {
        bodyRows.push(['Ajustes por redondeo técnico / Ítems particulares', '-', '-', formatCurrency(diff)]);
    }

    // Filtrar para excluir cualquier deuda que corresponda al mismo período de la liquidación actual
    const priorDebts = (unit.debts || []).filter(debt => !isCurrentPeriodDebt(debt.period, settlement.month));

    // Cálculo e inyección de Deuda Histórica Real (SOLO deudas de períodos anteriores)
    let totalHistoricalDebt = 0;
    const initialBalance = unit.initialBalance || 0;
    if (initialBalance > 0) totalHistoricalDebt += initialBalance;
    priorDebts.forEach(debt => {
        totalHistoricalDebt += debt.total;
    });

    if (totalHistoricalDebt > 0) {
        bodyRows.push([
            { content: 'DEUDA ANTERIOR / SALDO PENDIENTE (Ver detalle en Anexo Pág. 2)', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', textColor: [220, 38, 38], fillColor: [254, 226, 226], fontSize: 8 } },
            { content: formatCurrency(totalHistoricalDebt), styles: { fontStyle: 'bold', halign: 'right', textColor: [220, 38, 38], fillColor: [254, 226, 226], fontSize: 8 } }
        ]);
    }

    const finalTotalToPay = exactAmountToPayMonth + totalHistoricalDebt;

    // Fila FINAL de TOTAL
    bodyRows.push([
        { content: 'TOTAL COMPLETO A PAGAR', colSpan: 3, styles: { fontStyle: 'bold', fontSize: 9.5, textColor: [255, 255, 255], fillColor: THEME.primary } },
        { content: formatCurrency(finalTotalToPay), styles: { fontStyle: 'bold', fontSize: 9.5, halign: 'right', textColor: [255, 255, 255], fillColor: THEME.primary } }
    ]);

    autoTable(doc, {
        startY: finalY, 
        head: [['DESCRIPCIÓN DEL CONCEPTO', 'TOTAL GENERAL', 'MÉTODO / %', 'TU CUOTA']], 
        body: bodyRows, 
        theme: 'plain',
        headStyles: { fillColor: THEME.secondary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: THEME.text, cellPadding: 1.6 },
        columnStyles: { 
            0: { cellWidth: 80 }, 
            1: { cellWidth: 30, halign: 'right' }, 
            2: { cellWidth: 32, halign: 'center' }, 
            3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' } 
        },
        margin: { left: 14, right: 14 },
        alternateRowStyles: { fillColor: THEME.stripe }
    });

    // @ts-ignore
    finalY = doc.lastAutoTable.finalY + 4;

    const interestRate = settings.interestRate || 0;
    const interestAmount = (finalTotalToPay * interestRate) / 100;
    const secondDueTotal = finalTotalToPay + interestAmount;

    const vto1 = settlement.firstExpirationDate ? formatDate(settlement.firstExpirationDate) : '-';
    const vto2 = settlement.secondExpirationDate ? formatDate(settlement.secondExpirationDate) : '-';

    // Cuadro de Vencimientos e Importes (12 mm)
    doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, finalY, pageWidth - 28, 12, 1.5, 1.5, 'FD');

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.text(`1° VTO (${vto1}):`, 20, finalY + 7.5);
    doc.setFontSize(9.5);
    doc.text(`${formatCurrency(finalTotalToPay)}`, 62, finalY + 7.5);

    if (interestRate > 0) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(THEME.secondary[0], THEME.secondary[1], THEME.secondary[2]);
        doc.text(`2° VTO (${vto2}) [+${interestRate}%]:`, 110, finalY + 7.5);
        doc.setFontSize(9);
        doc.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
        doc.text(`${formatCurrency(secondDueTotal)}`, pageWidth - 20, finalY + 7.5, { align: 'right' });
    }

    finalY += 16;

    // Caja de Modalidad de Pago: Transferencia Bancaria vs Efectivo en Administración
    const showBank = settings.showBankDetailsOnCoupon !== false && Boolean(settings.bankCBU || settings.bankAlias || settings.bankName);

    if (showBank) {
        doc.setDrawColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(14, finalY, pageWidth - 28, 15, 1.5, 1.5, 'FD');

        doc.setFontSize(8); 
        doc.setFont("helvetica", "bold"); 
        doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
        doc.text("DATOS PARA TRANSFERENCIA BANCARIA", 20, finalY + 4.5);
        
        doc.setFontSize(7.5); 
        doc.setFont("helvetica", "normal"); 
        doc.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
        
        const holderPart = settings.bankHolder ? `   |   Titular: ${settings.bankHolder}` : '';
        const cuitPart = settings.bankCuit ? `   |   CUIT: ${settings.bankCuit}` : '';
        doc.text(`Banco: ${settings.bankName || '-'}${holderPart}${cuitPart}`, 20, finalY + 9);
        doc.setFont("helvetica", "bold"); 
        doc.text(`CBU: ${settings.bankCBU || '-'}   |   Alias: ${(settings.bankAlias || '-').toUpperCase()}`, 20, finalY + 13);
        
        finalY += 18;
    } else {
        doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, finalY, pageWidth - 28, 10, 1.5, 1.5, 'FD');

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(THEME.secondary[0], THEME.secondary[1], THEME.secondary[2]);
        doc.text("MODALIDAD DE PAGO: En efectivo en Administración del Consorcio", 20, finalY + 6.5);

        finalY += 13;
    }

    // Pie de página con aviso si existe
    if (settlement.couponMessage) {
        doc.setFontSize(7.5); 
        doc.setFont("helvetica", "italic"); 
        doc.setTextColor(THEME.secondary[0], THEME.secondary[1], THEME.secondary[2]);
        doc.text(`Aviso: ${settlement.couponMessage}`, 14, finalY + 2, { maxWidth: pageWidth - 28 });
    }

    // --- PÁGINA 2: ANEXO DE DEUDA HISTÓRICA (Solo si tiene deuda acumulada) ---
    if (totalHistoricalDebt > 0) {
        doc.addPage();
        drawHeader(doc, consortium, "ANEXO: DETALLE DE DEUDA", settlement);
        
        let anexoY = 44;
        doc.setFontSize(13);
        doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
        doc.setFont("helvetica", "bold");
        doc.text(`Unidad: ${unit.unitNumber || '-'}`, 14, anexoY);
        
        doc.setFontSize(9.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
        doc.text(`Propietario: ${unit.ownerName || 'A designar'}`, 14, anexoY + 6);

        anexoY += 12;
        const debtRows: any[][] = [];
        
        if (initialBalance > 0) {
            debtRows.push(['Saldo Inicial / Deuda Previa', formatCurrency(initialBalance), '-', formatCurrency(initialBalance)]);
        }
        priorDebts.forEach(debt => {
            const interestDetail = debt.interestAmount > 0 ? `${formatCurrency(debt.interestAmount)} (${debt.interestRate}%)` : '-';
            debtRows.push([debt.period, formatCurrency(debt.baseAmount), interestDetail, formatCurrency(debt.total)]);
        });
        debtRows.push(['TOTAL DEUDA ACUMULADA', '', '', formatCurrency(totalHistoricalDebt)]);

        autoTable(doc, {
            startY: anexoY,
            head: [['PERÍODO / CONCEPTO', 'IMPORTE BASE', 'INTERÉS', 'SUBTOTAL']],
            body: debtRows,
            theme: 'plain',
            headStyles: { fillColor: THEME.secondary, textColor: [255,255,255], fontStyle: 'bold', fontSize: 8.5 },
            bodyStyles: { fontSize: 8, textColor: THEME.text, cellPadding: 2.5 },
            columnStyles: { 
                0: { cellWidth: 70 }, 
                1: { halign: 'right' }, 
                2: { halign: 'center' }, 
                3: { halign: 'right', fontStyle: 'bold' } 
            },
            alternateRowStyles: { fillColor: THEME.stripe },
            didParseCell: (data) => {
                if (data.row.index === debtRows.length - 1 && data.section === 'body') {
                    data.cell.styles.fillColor = [254, 226, 226];
                    data.cell.styles.textColor = [220, 38, 38];
                    data.cell.styles.fontSize = 9.5;
                }
            }
        });
    }

    addPageNumbers(doc);
    return doc;
};

export const generateIndividualCouponPDF = (settlement: SettlementRecord, unit: Unit, consortium: Consortium, settings: ConsortiumSettings, allUnitsData: Unit[]) => {
    const doc = createCouponDoc(settlement, unit, consortium, settings, allUnitsData);
    const safeUnit = (unit.unitNumber || '00').replace(/[^a-z0-9]/gi, '_');
    doc.save(`CUPON_DE_PAGO_${safeUnit}.pdf`);
};

export const generateCouponBase64 = (settlement: SettlementRecord, unit: Unit, consortium: Consortium, settings: ConsortiumSettings, allUnitsData: Unit[]): string => {
    const doc = createCouponDoc(settlement, unit, consortium, settings, allUnitsData);
    return doc.output('datauristring').split(',')[1]; 
};

export const generateSettlementPDF = (settlement: SettlementRecord, consortium: Consortium, units: Unit[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  drawHeader(doc, consortium, "LIQUIDACIÓN GENERAL", settlement);
  
  let finalY = 45;

  const expenses = settlement.snapshotExpenses || [];
  const ordinaryExpenses = expenses.filter(e => e.category === 'Ordinary' && e.distributionType !== 'FROM_RESERVE').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const extraordinaryExpenses = expenses.filter(e => e.category === 'Extraordinary' && e.distributionType !== 'FROM_RESERVE').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const reserveExpenses = expenses.filter(e => e.distributionType === 'FROM_RESERVE').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const totalOrd = ordinaryExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalExtra = extraordinaryExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalReserveExp = reserveExpenses.reduce((sum, e) => sum + e.amount, 0);

  const drawExpenseTable = (title: string, dataRows: any[], total: number) => {
      doc.setFontSize(12); 
      doc.setFont("helvetica", "bold"); 
      doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
      doc.text(title, 14, finalY); 
      finalY += 3;
      
      const rows = dataRows.map(exp => [
        formatDate(exp.date),
        exp.itemCategory || 'General',
        exp.description + (exp.affectedUnitIds && exp.affectedUnitIds.length > 0 ? ' (*Distribución Específica)' : ''),
        formatCurrency(exp.amount)
      ]);
      
      autoTable(doc, {
        startY: finalY, 
        head: [['FECHA', 'RUBRO', 'DETALLE', 'IMPORTE']], 
        body: rows, 
        theme: 'plain',
        headStyles: { fillColor: THEME.secondary, textColor: [255,255,255], fontStyle: 'bold' },
        bodyStyles: { fontSize: 9, textColor: THEME.text, cellPadding: 3 },
        columnStyles: { 
            0: { cellWidth: 25 }, 
            1: { cellWidth: 35, fontStyle: 'bold' }, 
            2: { cellWidth: 'auto' }, 
            3: { cellWidth: 35, halign: 'right' } 
        },
        alternateRowStyles: { fillColor: THEME.stripe }
      });
      
      // @ts-ignore
      finalY = doc.lastAutoTable.finalY + 5;
      
      doc.setFont("helvetica", "bold"); 
      doc.setFontSize(11); 
      doc.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
      doc.text(`Subtotal: ${formatCurrency(total)}`, pageWidth - 14, finalY, { align: 'right' });
      finalY += 10;
  };

  if (ordinaryExpenses.length > 0) {
      drawExpenseTable("GASTOS ORDINARIOS", ordinaryExpenses, totalOrd);
  }
  
  if (extraordinaryExpenses.length > 0) { 
      if (finalY > 230) { doc.addPage(); finalY = 20; } 
      drawExpenseTable("GASTOS EXTRAORDINARIOS", extraordinaryExpenses, totalExtra); 
  }

  if (reserveExpenses.length > 0) { 
      if (finalY > 230) { doc.addPage(); finalY = 20; } 
      drawExpenseTable("GASTOS CUBIERTOS CON FONDO DE RESERVA", reserveExpenses, totalReserveExp); 
  }

  // TOTAL DE GASTOS DEL PERIODO
  if (finalY > 250) { doc.addPage(); finalY = 20; }
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
  doc.text(`TOTAL GASTOS DEL PERÍODO (Ord. + Ext.): ${formatCurrency(totalOrd + totalExtra)}`, pageWidth - 14, finalY, { align: 'right' });
  finalY += 15;

  // RESUMEN DE COBROS
  const payments = settlement.snapshotPayments || [];
  if (payments.length > 0) {
      if (finalY > 220) { doc.addPage(); finalY = 20; }
      
      const paymentsByMonth: Record<string, number> = {};
      payments.forEach(p => {
          const m = p.date.substring(0, 7); // YYYY-MM
          paymentsByMonth[m] = (paymentsByMonth[m] || 0) + p.amount;
      });

      doc.setFontSize(12); 
      doc.setFont("helvetica", "bold"); 
      doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
      doc.text("INGRESOS / COBROS DEL PERÍODO", 14, finalY); 
      finalY += 3;

      const paymentRows = Object.keys(paymentsByMonth).sort().map(monthKey => {
          const [year, month] = monthKey.split('-');
          const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleString('es-AR', { month: 'long', year: 'numeric' });
          return [
              `Cobros mes de ${monthName}`,
              formatCurrency(paymentsByMonth[monthKey])
          ];
      });

      autoTable(doc, {
        startY: finalY, 
        head: [['CONCEPTO', 'TOTAL RECAUDADO']], 
        body: paymentRows, 
        theme: 'plain',
        headStyles: { fillColor: [16, 185, 129], textColor: [255,255,255], fontStyle: 'bold' }, // Emerald green for income
        bodyStyles: { fontSize: 10, textColor: THEME.text, cellPadding: 3 },
        columnStyles: { 
            0: { cellWidth: 'auto', fontStyle: 'bold' }, 
            1: { cellWidth: 50, halign: 'right', fontStyle: 'bold' } 
        },
        alternateRowStyles: { fillColor: [240, 253, 244] } // Light emerald stripe
      });

      // @ts-ignore
      finalY = doc.lastAutoTable.finalY + 5;
      
      doc.setFont("helvetica", "bold"); 
      doc.setFontSize(11); 
      doc.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
      doc.text(`Total Recaudado: ${formatCurrency(settlement.totalCollected || 0)}`, pageWidth - 14, finalY, { align: 'right' });
      finalY += 15;
  }
  
  if (finalY > 200) { doc.addPage(); finalY = 20; }

  // ESTADO FINANCIERO Y RESERVA
  doc.setFillColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]); 
  doc.roundedRect(14, finalY, pageWidth - 28, 60, 2, 2, 'F'); 
  
  doc.setFontSize(14); 
  doc.setTextColor(255, 255, 255); 
  doc.setFont("helvetica", "bold");
  doc.text("ESTADO FINANCIERO Y RESERVA", 20, finalY + 10);

  const col1X = 20; 
  const col2X = pageWidth - 25; 
  let currentY = finalY + 22; 
  const lh = 7; 
  
  doc.setFontSize(10); 
  doc.setFont("helvetica", "normal");
  
  doc.text("Fondo de Reserva Actual", col1X, currentY); 
  doc.text(formatCurrency(settlement.reserveBalanceStart), col2X, currentY, { align: 'right' }); 
  currentY += lh;
  
  if (settlement.reserveExpense > 0) { 
      doc.text("(-) Débitos en Liquidación Actual", col1X, currentY); 
      doc.text(`- ${formatCurrency(settlement.reserveExpense)}`, col2X, currentY, { align: 'right' }); 
      currentY += lh; 
      
      doc.setFont("helvetica", "bold");
      doc.text("Saldo Neto del Fondo", col1X, currentY);
      doc.text(formatCurrency(settlement.reserveBalanceStart - settlement.reserveExpense), col2X, currentY, { align: 'right' });
      currentY += lh;
      doc.setFont("helvetica", "normal");
  }
  
  doc.text("(+) Estimación a cobrar (Mes Corriente)", col1X, currentY); 
  doc.text(formatCurrency(settlement.reserveContribution), col2X, currentY, { align: 'right' }); 
  currentY += lh;
  
  doc.setDrawColor(255,255,255); 
  doc.line(20, currentY, pageWidth - 20, currentY); 
  currentY += 6;
  
  doc.setFontSize(12); 
  doc.setFont("helvetica", "bold");
  doc.text("SALDO FINAL DISPONIBLE (ESTIMADO)", col1X, currentY); 
  doc.text(formatCurrency(settlement.reserveBalanceAtClose), col2X, currentY, { align: 'right' });

  finalY += 75; 
  
  drawFooter(doc, settlement, pageWidth, finalY); 
  addPageNumbers(doc);
  
  doc.save(`Expensas_Generales_${(consortium.name || 'Consorcio').replace(/[^a-z0-9]/gi, '_')}_${settlement.month || 'Mes'}.pdf`);
};

export const generateReserveLedgerPDF = (ledgerData: any[], consortium: Consortium) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    drawHeader(doc, consortium, "MAYOR: FONDO DE RESERVA", { month: formatLocalDate() } as any);

    let finalY = 45;
    const currentBalance = ledgerData.length > 0 ? ledgerData[0].runningBalance : 0;

    doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
    doc.setFillColor(THEME.stripe[0], THEME.stripe[1], THEME.stripe[2]);
    doc.roundedRect(14, finalY, pageWidth - 28, 20, 2, 2, 'FD');
    
    doc.setFontSize(12); 
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]); 
    doc.setFont("helvetica", "bold");
    doc.text(`SALDO ACTUAL DISPONIBLE: ${formatCurrency(currentBalance)}`, 20, finalY + 12);
    
    finalY += 25;

    const tableBody = ledgerData.map(t => [
        formatDate(t.date), 
        t.description + (t.type === 'SYSTEM' ? ' (Auto)' : ''),
        t.amount > 0 ? formatCurrency(t.amount) : '-', 
        t.amount < 0 ? formatCurrency(Math.abs(t.amount)) : '-', 
        formatCurrency(t.runningBalance)
    ]);
    
    autoTable(doc, {
        startY: finalY, 
        head: [['FECHA', 'CONCEPTO', 'INGRESO (+)', 'EGRESO (-)', 'SALDO']], 
        body: tableBody, 
        theme: 'plain',
        headStyles: { fillColor: THEME.secondary, textColor: [255, 255, 255], fontStyle: 'bold' },
        bodyStyles: { fontSize: 9, textColor: THEME.text, cellPadding: 4 },
        columnStyles: { 
            0: { cellWidth: 25 }, 
            2: { halign: 'right', textColor: [22, 163, 74] }, 
            3: { halign: 'right', textColor: [220, 38, 38] }, 
            4: { halign: 'right', fontStyle: 'bold' } 
        },
        alternateRowStyles: { fillColor: THEME.stripe }
    });

    addPageNumbers(doc);
    doc.save(`Reserva_${(consortium.name || '').replace(/[^a-z0-9]/gi, '_')}.pdf`);
};

export const generateDebtDetailPDF = (unit: Unit, consortium: Consortium) => {
    const doc = new jsPDF(); 
    const pageWidth = doc.internal.pageSize.width;
    
    drawHeader(doc, consortium, "ESTADO DE DEUDA", { month: formatLocalDate() } as any);

    let finalY = 45;
    
    doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]); 
    doc.setFillColor(THEME.stripe[0], THEME.stripe[1], THEME.stripe[2]); 
    doc.roundedRect(14, finalY, pageWidth - 28, 25, 2, 2, 'FD');
    
    doc.setFontSize(14); 
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]); 
    doc.setFont("helvetica", "bold");
    doc.text(`Unidad: ${unit.unitNumber || '-'}`, 20, finalY + 10);
    
    doc.setFontSize(11); 
    doc.setFont("helvetica", "normal"); 
    doc.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
    doc.text(`Propietario: ${unit.ownerName || 'No asignado'}`, 20, finalY + 18);

    finalY += 35;
    
    let totalDebt = 0; 
    const tableBody: any[][] = [];

    if (unit.initialBalance && unit.initialBalance > 0) {
        tableBody.push(['Saldo Inicial / Deuda Previa', formatCurrency(unit.initialBalance), '-', '-', formatCurrency(unit.initialBalance)]);
        totalDebt += unit.initialBalance;
    }
    
    (unit.debts || []).forEach(debt => {
        totalDebt += debt.total;
        tableBody.push([
            debt.period, 
            formatCurrency(debt.baseAmount), 
            `${debt.interestRate}%`, 
            formatCurrency(debt.interestAmount), 
            formatCurrency(debt.total)
        ]);
    });

    if (tableBody.length === 0) {
        tableBody.push([{ content: 'No registra deuda histórica.', colSpan: 5, styles: { halign: 'center', fontStyle: 'italic' } }]);
    }

    autoTable(doc, {
        startY: finalY, 
        head: [['PERÍODO', 'IMPORTE BASE', '% INT.', 'INTERÉS', 'SUBTOTAL']], 
        body: tableBody, 
        theme: 'plain',
        headStyles: { fillColor: THEME.secondary, textColor: [255, 255, 255], fontStyle: 'bold' },
        bodyStyles: { fontSize: 10, textColor: THEME.text, cellPadding: 4 },
        columnStyles: { 
            1: { halign: 'right' }, 
            2: { halign: 'center' }, 
            3: { halign: 'right' }, 
            4: { halign: 'right', fontStyle: 'bold' } 
        },
        alternateRowStyles: { fillColor: THEME.stripe }
    });

    // @ts-ignore
    finalY = doc.lastAutoTable.finalY + 10;
    
    doc.setFillColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]); 
    doc.roundedRect(pageWidth - 90, finalY, 76, 12, 1, 1, 'F');
    doc.setTextColor(255, 255, 255); 
    doc.setFontSize(12); 
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL ADEUDADO: ${formatCurrency(totalDebt)}`, pageWidth - 86, finalY + 8);
    
    addPageNumbers(doc); 
    doc.save(`Deuda_${(unit.unitNumber || '').replace(/[^a-z0-9]/gi, '_')}.pdf`);
};

export const generateUnitLedgerPDF = (unit: Unit, payments: Payment[], consortium: Consortium) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    drawHeader(doc, consortium, "ESTADO DE CUENTA", { month: formatLocalDate() } as any);

    let finalY = 45;
    
    doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
    doc.setFillColor(THEME.stripe[0], THEME.stripe[1], THEME.stripe[2]);
    doc.roundedRect(14, finalY, pageWidth - 28, 25, 2, 2, 'FD');
    
    doc.setFontSize(14); 
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]); 
    doc.setFont("helvetica", "bold");
    doc.text(`Unidad: ${unit.unitNumber || '-'}`, 20, finalY + 10);
    
    doc.setFontSize(11); 
    doc.setFont("helvetica", "normal"); 
    doc.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
    doc.text(`Propietario: ${unit.ownerName || 'No asignado'}`, 20, finalY + 18);

    finalY += 35;

    const items: any[] = [];
    
    if (unit.initialBalance) {
        items.push({ date: '-', concept: 'Saldo Inicial / Deuda Previa', charge: unit.initialBalance, payment: 0 });
    }
    
    if (unit.debts) {
        unit.debts.forEach(d => {
            items.push({ date: d.period, concept: `Deuda Histórica / Recargo`, charge: d.total, payment: 0 });
        });
    }
    
    payments.filter(p => p.unitId === unit.id && p.status === 'APPROVED').forEach(p => {
        items.push({ date: formatLocalDate(p.date), concept: `Pago Realizado (${p.method})`, charge: 0, payment: p.amount });
    });

    const tableBody: any[][] = items.map(t => [ 
        t.date, 
        t.concept, 
        t.charge > 0 ? formatCurrency(t.charge) : '-', 
        t.payment > 0 ? formatCurrency(t.payment) : '-' 
    ]);

    if (tableBody.length === 0) {
        tableBody.push([{ content: 'No registra movimientos.', colSpan: 4, styles: { halign: 'center', fontStyle: 'italic' } }]);
    }

    autoTable(doc, {
        startY: finalY,
        head: [['FECHA / PERÍODO', 'CONCEPTO', 'CARGO (+)', 'PAGO (-)']],
        body: tableBody,
        theme: 'plain',
        headStyles: { fillColor: THEME.secondary, textColor: [255, 255, 255], fontStyle: 'bold' },
        bodyStyles: { fontSize: 10, textColor: THEME.text, cellPadding: 4 },
        columnStyles: { 
            0: { cellWidth: 35 }, 
            2: { halign: 'right', textColor: [220, 38, 38] }, 
            3: { halign: 'right', textColor: [22, 163, 74] } 
        },
        alternateRowStyles: { fillColor: THEME.stripe }
    });

    // @ts-ignore
    finalY = doc.lastAutoTable.finalY + 10;
    
    const balance = items.reduce((acc, curr) => acc + curr.charge - curr.payment, 0);

    doc.setFillColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.roundedRect(pageWidth - 90, finalY, 76, 12, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12); 
    doc.setFont("helvetica", "bold");
    doc.text(`SALDO TOTAL: ${formatCurrency(balance)}`, pageWidth - 86, finalY + 8);
    
    addPageNumbers(doc);
    doc.save(`Estado_Cuenta_${(unit.unitNumber || '').replace(/[^a-z0-9]/gi, '_')}.pdf`);
};