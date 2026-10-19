// Contracts are matched by CFTC contract market code, which survives the market
// renames CFTC applies over the years (e.g. "CRUDE OIL, LIGHT SWEET" -> "WTI-PHYSICAL").
export const contracts = [
  {
    key: "gold",
    cftcCode: "088691",
    reportType: "disaggregated",
    yahooFinanceSymbol: "GC=F",
  },
  {
    key: "silver",
    cftcCode: "084691",
    reportType: "disaggregated",
    yahooFinanceSymbol: "SI=F",
  },
  {
    key: "copper",
    cftcCode: "085692",
    reportType: "disaggregated",
    yahooFinanceSymbol: "HG=F",
  },
  {
    key: "platinum",
    cftcCode: "076651",
    reportType: "disaggregated",
    yahooFinanceSymbol: "PL=F",
  },
  {
    key: "palladium",
    cftcCode: "075651",
    reportType: "disaggregated",
    yahooFinanceSymbol: "PA=F",
  },
  {
    key: "wti-crude-oil",
    cftcCode: "067651",
    reportType: "disaggregated",
    yahooFinanceSymbol: "CL=F",
  },
  {
    key: "brent-crude-oil",
    cftcCode: "06765T",
    reportType: "disaggregated",
    yahooFinanceSymbol: "BZ=F",
  },
  {
    key: "natural-gas",
    cftcCode: "023651",
    reportType: "disaggregated",
    yahooFinanceSymbol: "NG=F",
  },
  {
    key: "rbob-gasoline",
    cftcCode: "111659",
    reportType: "disaggregated",
    yahooFinanceSymbol: "RB=F",
  },
  {
    key: "heating-oil",
    cftcCode: "022651",
    reportType: "disaggregated",
    yahooFinanceSymbol: "HO=F",
  },
  {
    key: "euro-fx",
    cftcCode: "099741",
    reportType: "financial",
    yahooFinanceSymbol: "EURUSD=X",
  },
  {
    key: "british-pound",
    cftcCode: "096742",
    reportType: "financial",
    yahooFinanceSymbol: "GBPUSD=X",
  },
  {
    key: "japanese-yen",
    cftcCode: "097741",
    reportType: "financial",
    yahooFinanceSymbol: "USDJPY=X",
  },
  {
    key: "australian-dollar",
    cftcCode: "232741",
    reportType: "financial",
    yahooFinanceSymbol: "AUDUSD=X",
  },
  {
    key: "swiss-franc",
    cftcCode: "092741",
    reportType: "financial",
    yahooFinanceSymbol: "USDCHF=X",
  },
  {
    key: "canadian-dollar",
    cftcCode: "090741",
    reportType: "financial",
    yahooFinanceSymbol: "USDCAD=X",
  },
  {
    key: "new-zealand-dollar",
    cftcCode: "112741",
    reportType: "financial",
    yahooFinanceSymbol: "NZDUSD=X",
  },
  {
    key: "mexican-peso",
    cftcCode: "095741",
    reportType: "financial",
    yahooFinanceSymbol: "USDMXN=X",
  },
];
