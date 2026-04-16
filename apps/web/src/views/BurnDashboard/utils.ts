export const getBurnInfoPrecision = (value: number) => {
  // if value is greater than 100 million but less than a billion, return 0
  if (value >= 100_000_000 && value <= 1_000_000_000) {
    return 0
  }

  return undefined
}

export const getPeakSupply = (series: { total_supply: number }[]): number => {
  return series.reduce((max, entry) => (entry.total_supply > max ? entry.total_supply : max), 0)
}
