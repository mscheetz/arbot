export class ArbitragePath {
    constructor() {}

    id: string;
    exchange: string;
    previous: string;
    value: number;
    orderBookValue: number;
    pair: string;
    price: string;
    unit: string;
    continue: boolean;
    possible: boolean;
    bestPrice: string;
    buy: boolean;
    final: number;
    tradeQuantity: number;
    fee: number;
    feeUnit: string;
}