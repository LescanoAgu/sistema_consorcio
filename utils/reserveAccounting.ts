import { ConsortiumSettings, DebtItem, Payment, SettlementRecord, Unit } from '../types';
import { normalizePeriod } from '../services/pdfService';

export interface PaymentReserveBreakdown {
  paymentId: string;
  unitId: string;
  unitNumber: string;
  isOccupied: boolean;
  totalPaid: number;
  basePaid: number;
  interestPaid: number;
  extraordinaryPaid: number;
  expectedReserveContribution: number;
  naiveReserveContribution: number; // Lo que daba la fórmula vieja: totalPaid * rate / (100 + rate)
  difference: number; // naive - expected (exceso acreditado por mora, extraordinarias o local libre)
}

/**
 * Verifica si una unidad funcional está ocupada y aporta al Fondo de Reserva.
 * Los locales libres/desocupados están exentos y aportan $0.
 */
export const doesUnitContributeToReserve = (unit?: Unit): boolean => {
  if (!unit) return true;
  return unit.contributesToReserve !== false && unit.isOccupied !== false;
};

/**
 * Calcula la proporción de Fondo de Reserva dentro del monto base (sin mora) de un período.
 * - Excluye intereses por mora (100% fuera de la reserva).
 * - Excluye gastos extraordinarios (la reserva solo aplica sobre gastos ordinarios).
 * - Devuelve $0 si el local está libre / exento.
 */
export const calculateReserveForPeriodBase = (
  basePaid: number,
  period: string,
  unit: Unit | undefined,
  history: SettlementRecord[],
  settings: ConsortiumSettings,
  debtItem?: DebtItem
): { reserveAmount: number; extraordinaryPart: number } => {
  const rate = Number(settings.monthlyReserveContributionPercentage || 0);
  if (rate <= 0 || basePaid <= 0 || !doesUnitContributeToReserve(unit)) {
    return { reserveAmount: 0, extraordinaryPart: 0 };
  }

  // 1. Si el DebtItem ya tiene el desglose guardado en el cierre de liquidación
  if (debtItem && debtItem.reserveAmount !== undefined && debtItem.baseAmount > 0) {
    const grossBase = (debtItem.ordinaryAmount || 0) + (debtItem.extraordinaryAmount || 0) + (debtItem.reserveAmount || 0);
    const denom = grossBase > 0 ? grossBase : debtItem.baseAmount;
    const ratioReserve = debtItem.reserveAmount / denom;
    const ratioExt = (debtItem.extraordinaryAmount || 0) / denom;
    return {
      reserveAmount: Number((basePaid * ratioReserve).toFixed(2)),
      extraordinaryPart: Number((basePaid * ratioExt).toFixed(2))
    };
  }

  // 2. Buscar el período en el historial de liquidaciones cerradas
  if (period && period !== 'initial-balance' && history && history.length > 0) {
    const normTarget = normalizePeriod(period);
    const matchingSettlement = history.find(h => normalizePeriod(h.month) === normTarget);

    if (matchingSettlement) {
      const unitDetail = matchingSettlement.unitDetails?.find(ud => ud.unitId === unit?.id);
      if (unitDetail && unitDetail.reserveAmount !== undefined && unitDetail.totalToPay > 0) {
        const denom = unitDetail.totalToPay + (unitDetail.creditApplied || 0);
        const ratioReserve = denom > 0 ? unitDetail.reserveAmount / denom : 0;
        const ratioExt = denom > 0 ? (unitDetail.extraordinaryAmount || 0) / denom : 0;
        return {
          reserveAmount: Number((basePaid * ratioReserve).toFixed(2)),
          extraordinaryPart: Number((basePaid * ratioExt).toFixed(2))
        };
      }

      // Calcular proporción desde snapshotExpenses de esa liquidación
      const expenses = matchingSettlement.snapshotExpenses || [];
      const ordTotal = expenses
        .filter(e => e.category === 'Ordinary' && e.distributionType !== 'FROM_RESERVE')
        .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
      const extTotal = expenses
        .filter(e => e.category === 'Extraordinary' && e.distributionType !== 'FROM_RESERVE')
        .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

      if (ordTotal + extTotal > 0) {
        const ordWithReserve = ordTotal * (1 + rate / 100);
        const totalQuotaDenom = ordWithReserve + extTotal;
        const reservePartOfQuota = (ordTotal * (rate / 100)) / totalQuotaDenom;
        const extPartOfQuota = extTotal / totalQuotaDenom;
        return {
          reserveAmount: Number((basePaid * reservePartOfQuota).toFixed(2)),
          extraordinaryPart: Number((basePaid * extPartOfQuota).toFixed(2))
        };
      }
    }
  }

  // 3. Por defecto (gastos 100% ordinarios sin mora): basePaid * rate / (100 + rate)
  return {
    reserveAmount: Number((basePaid * (rate / (100 + rate))).toFixed(2)),
    extraordinaryPart: 0
  };
};

/**
 * Analiza un cobro (Payment) y determina exactamente cuánto corresponde al Fondo de Reserva,
 * separando:
 * - Locales libres / exentos ($0 a reserva)
 * - Intereses por mora ($0 a reserva)
 * - Gastos extraordinarios ($0 a reserva)
 * - Expensas ordinarias de unidades ocupadas (única base que aporta a reserva)
 */
export const analyzePaymentReserve = (
  payment: Payment,
  units: Unit[],
  history: SettlementRecord[],
  settings: ConsortiumSettings
): PaymentReserveBreakdown => {
  const rate = Number(settings.monthlyReserveContributionPercentage || 0);
  const unit = units.find(u => u.id === payment.unitId);
  const isOccupied = doesUnitContributeToReserve(unit);
  const totalPaid = Number(payment.amount || 0);
  const naiveReserveContribution = rate > 0 ? Number((totalPaid * (rate / (100 + rate))).toFixed(2)) : 0;

  // Si el local está libre / desocupado, NO aporta nada al Fondo de Reserva
  if (!isOccupied || rate <= 0 || totalPaid <= 0) {
    return {
      paymentId: payment.id,
      unitId: payment.unitId,
      unitNumber: unit?.unitNumber || '?',
      isOccupied,
      totalPaid,
      basePaid: totalPaid,
      interestPaid: 0,
      extraordinaryPaid: 0,
      expectedReserveContribution: 0,
      naiveReserveContribution,
      difference: Number((naiveReserveContribution - 0).toFixed(2))
    };
  }

  let totalBasePaid = 0;
  let totalInterestPaid = 0;
  let totalExtraordinaryPaid = 0;
  let totalReserve = 0;

  if (payment.allocations && payment.allocations.length > 0) {
    for (const alloc of payment.allocations) {
      const allocAmount = Number(alloc.amount || 0);
      if (allocAmount <= 0) continue;

      let basePart = allocAmount;
      let interestPart = 0;

      if (alloc.basePaid !== undefined || alloc.interestPaid !== undefined) {
        interestPart = Number(alloc.interestPaid || 0);
        basePart = alloc.basePaid !== undefined ? Number(alloc.basePaid) : Math.max(0, allocAmount - interestPart);
      } else if (alloc.period && alloc.period !== 'initial-balance') {
        // Detectar mora comparando contra la cuota original del período en el historial
        const normP = normalizePeriod(alloc.period);
        const matchingSettlement = history.find(h => normalizePeriod(h.month) === normP);
        const unitDetail = matchingSettlement?.unitDetails?.find(ud => ud.unitId === payment.unitId);

        if (unitDetail && unitDetail.totalToPay > 0 && allocAmount > unitDetail.totalToPay + 0.05) {
          basePart = Number(unitDetail.totalToPay.toFixed(2));
          interestPart = Number((allocAmount - basePart).toFixed(2));
        }
      }

      totalBasePaid = Number((totalBasePaid + basePart).toFixed(2));
      totalInterestPaid = Number((totalInterestPaid + interestPart).toFixed(2));

      if (alloc.reservePaid !== undefined) {
        totalReserve = Number((totalReserve + Number(alloc.reservePaid)).toFixed(2));
      } else {
        const debtItem = unit?.debts?.find(d => normalizePeriod(d.period) === normalizePeriod(alloc.period));
        const { reserveAmount, extraordinaryPart } = calculateReserveForPeriodBase(
          basePart,
          alloc.period,
          unit,
          history,
          settings,
          debtItem
        );
        totalReserve = Number((totalReserve + reserveAmount).toFixed(2));
        totalExtraordinaryPaid = Number((totalExtraordinaryPaid + extraordinaryPart).toFixed(2));
      }
    }
  } else {
    // Pago sin allocations detalladas (histórico o directo)
    let basePart = totalPaid;
    let interestPart = 0;

    if (history && history.length > 0) {
      // Buscar la liquidación más cercana anterior o igual a la fecha del pago
      const payTime = new Date(payment.date).getTime();
      const sortedHist = [...history].sort((a, b) => new Date(b.dateClosed).getTime() - new Date(a.dateClosed).getTime());
      const candidate = sortedHist.find(h => new Date(h.dateClosed).getTime() <= payTime + 86400000 * 15) || sortedHist[0];
      const unitDetail = candidate?.unitDetails?.find(ud => ud.unitId === payment.unitId);

      // Si el pago supera la cuota original de ese período (hasta un 80% arriba por mora acumulada), el excedente es mora
      if (unitDetail && unitDetail.totalToPay > 0 && totalPaid > unitDetail.totalToPay + 0.05 && totalPaid <= unitDetail.totalToPay * 1.8) {
        basePart = Number(unitDetail.totalToPay.toFixed(2));
        interestPart = Number((totalPaid - basePart).toFixed(2));
      }

      const { reserveAmount, extraordinaryPart } = calculateReserveForPeriodBase(
        basePart,
        candidate?.month || '',
        unit,
        history,
        settings
      );
      totalBasePaid = basePart;
      totalInterestPaid = interestPart;
      totalExtraordinaryPaid = extraordinaryPart;
      totalReserve = reserveAmount;
    } else {
      totalBasePaid = basePart;
      totalReserve = Number((basePart * (rate / (100 + rate))).toFixed(2));
    }
  }

  return {
    paymentId: payment.id,
    unitId: payment.unitId,
    unitNumber: unit?.unitNumber || '?',
    isOccupied,
    totalPaid,
    basePaid: totalBasePaid,
    interestPaid: totalInterestPaid,
    extraordinaryPaid: totalExtraordinaryPaid,
    expectedReserveContribution: totalReserve,
    naiveReserveContribution,
    difference: Number((naiveReserveContribution - totalReserve).toFixed(2))
  };
};
