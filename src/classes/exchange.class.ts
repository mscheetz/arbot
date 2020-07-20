export class Exchange {
    name: string;
    trading: boolean;
    maker: number;
    taker: number;
    reverseAssets: string[];
    bestValue: number;

    constructor(name: string, trading: boolean) {
        this.name = name;
        this.trading = trading;
        this.maker = 0;
        this.taker = 0;
        this.reverseAssets = [];
        this.bestValue = 0;
    }
}