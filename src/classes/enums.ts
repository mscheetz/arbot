export enum TradeType {
    LIMIT = "LIMIT",
    MARKET = "MARKET"
}

export enum TradeSide {
    BUY = "BUY",
    SELL = "SELL"
}

export enum OrderStatus { 
    NONE,
    OPEN,
    FILLED,
    CANCELED
}

export enum LogLevel {
    VERBOSE = "VERBOSE",
    DEBUG = "DEBUG",
    INFORMATION = "INFORMATION",
    ERROR = "ERROR"
}