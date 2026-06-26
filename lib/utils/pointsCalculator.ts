export interface RedeemCalculation {
  redeemablePoints: number;
  remainingPoints: number;
  totalMinutes: number;
  hours: number;
  minutes: number;
}

const REDEEM_UNIT = 20;
const MINUTES_PER_UNIT = 8;

export function calculateRedeemTime(points: number): RedeemCalculation {
  if (points <= 0 || !Number.isInteger(points)) {
    return { redeemablePoints: 0, remainingPoints: 0, totalMinutes: 0, hours: 0, minutes: 0 };
  }

  const redeemablePoints = Math.floor(points / REDEEM_UNIT) * REDEEM_UNIT;
  const remainingPoints = points - redeemablePoints;
  const totalMinutes = (redeemablePoints / REDEEM_UNIT) * MINUTES_PER_UNIT;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return { redeemablePoints, remainingPoints, totalMinutes, hours, minutes };
}

export function isValidRedeemPoints(points: number): boolean {
  return (
    Number.isInteger(points) &&
    points >= REDEEM_UNIT &&
    points % REDEEM_UNIT === 0
  );
}

export const QUICK_AMOUNTS = [20, 40, 100, 200, 500];
