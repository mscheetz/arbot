export class PriceItem {
    constructor(pair: string, baseAsset: string, quoteAsset: string, price: string) {
        this.pair = pair;
        this.baseAsset = baseAsset;
        this.quoteAsset = quoteAsset;
        this.price = price;
        this.basePrecision = 0;
        this.quotePrecision = 0;
        this.stepSize = 0;
    }

    pair: string;
    baseAsset: string;
    quoteAsset: string;
    price: string;
    basePrecision: number;
    quotePrecision: number;
    stepSize: number;
}