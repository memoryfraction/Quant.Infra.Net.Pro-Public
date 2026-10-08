"""
Build prices.csv for the Alpha Wealth Lab all-weather calculator backtest.

Usage:
    pip install yfinance pandas
    python build_prices.py            # writes prices.csv next to this script
    python build_prices.py --start 2015-01-01

Output: monthly (month-end) total-return price index per column, dividends reinvested.
Columns: Date, SPY, QQQ, QQQI, IBIT, VNQ, XLE, IAUM, URAN, LEAPS, SGOV

Funds that launched recently are spliced onto a stand-in series before their launch.
The stand-in is rescaled so the two series join at the first month the real fund exists.
"""
import argparse
import pandas as pd
import yfinance as yf

# column -> (real ticker, stand-in ticker or None)
SERIES = {
    "SPY":   ("SPY",  None),
    "QQQ":   ("QQQ",  None),
    "QQQI":  ("QQQI", "QYLD"),     # NEOS Nasdaq-100 High Income, launched 2024-01; QYLD is a more conservative buy-write
    "IBIT":  ("IBIT", "BTC-USD"),  # iShares Bitcoin Trust, launched 2024-01; spot BTC before that
    "VNQ":   ("VNQ",  None),
    "XLE":   ("XLE",  None),
    "IAUM":  ("IAUM", "GLD"),      # launched 2021-06
    "URAN":  ("URAN", "URA"),      # recent launch; Global X Uranium before that
    "LEAPS": ("QLD",  None),       # 2x Nasdaq-100 as a rough stand-in for the LEAPS sleeve
    "SGOV":  ("SGOV", "BIL"),      # launched 2020-05
}


def monthly(ticker: str, start: str) -> pd.Series:
    df = yf.download(ticker, start=start, auto_adjust=True, progress=False)
    if df.empty:
        return pd.Series(dtype=float, name=ticker)
    close = df["Close"]
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]
    return close.resample("ME").last().dropna().rename(ticker)


def splice(real: pd.Series, proxy: pd.Series) -> pd.Series:
    if real.empty:
        return proxy
    first = real.index[0]
    if first not in proxy.index:
        return real
    scale = real.loc[first] / proxy.loc[first]
    head = proxy[proxy.index < first] * scale
    return pd.concat([head, real])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default="2015-01-01")
    ap.add_argument("--out", default="prices.csv")
    args = ap.parse_args()

    # fetch a little earlier so the first month-end exists for every series
    fetch_start = (pd.Timestamp(args.start) - pd.DateOffset(months=2)).strftime("%Y-%m-%d")
    cols = {}
    for col, (real_t, proxy_t) in SERIES.items():
        real = monthly(real_t, fetch_start)
        s = splice(real, monthly(proxy_t, fetch_start)) if proxy_t else real
        print(f"{col:6s} {real_t:8s} real from {real.index[0].date() if not real.empty else 'n/a'}"
              + (f", stand-in {proxy_t}" if proxy_t else ""))
        cols[col] = s

    df = pd.DataFrame(cols)
    df = df[df.index >= pd.Timestamp(args.start)].dropna()
    # drop the current, unfinished month
    today = pd.Timestamp.today()
    if len(df) and df.index[-1].year == today.year and df.index[-1].month == today.month:
        df = df.iloc[:-1]
    df.index = df.index.strftime("%Y-%m-%d")
    df.index.name = "Date"
    df.round(6).to_csv(args.out)
    print(f"Wrote {args.out}: {df.index[0]} to {df.index[-1]}, {len(df)} months")


if __name__ == "__main__":
    main()
