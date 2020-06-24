export class PriceItem {
    constructor(pair: string, baseAsset: string, quoteAsset: string, price: string) {
        this.pair = pair;
        this.baseAsset = baseAsset;
        this.quoteAsset = quoteAsset;
        this.price = price;
    }

    pair: string;
    baseAsset: string;
    quoteAsset: string;
    price: string;
}