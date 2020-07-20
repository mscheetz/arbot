export class PriceItem {
    constructor(exchange: string, pair: string, baseAsset: string, quoteAsset: string, price: string) {
        this.exchange = exchange;
        this.pair = pair;
        this.baseAsset = baseAsset;
        this.quoteAsset = quoteAsset;
        this.price = price;
        this.basePrecision = 0;
        this.quotePrecision = 0;
        this.stepSize = 0;
    }

    exchange: string;
    pair: string;
    baseAsset: string;
    quoteAsset: string;
    price: string;
    basePrecision: number;
    quotePrecision: number;
    stepSize: number;
}