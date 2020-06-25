import BinanceService from "./binance.service";
import { Depth } from "../classes/depth.class";
import { PriceItem } from "../classes/price-item.class";
import { TradeSide } from "../classes/enums";

class ExchangeService {
    private exchange: string;
    private binanceSvc: BinanceService;

    constructor(exchange: string) {
        this.exchange = exchange;
        this.binanceSvc = new BinanceService();
    }

    public serviceReady() {
        if(this.exchange === "BINANCE") {
            return this.binanceSvc.serviceReady();
        }

        return false;
    }

    public test = async() => {
        let status = false;

        if(this.exchange === "BINANCE") {
            status = await this.binanceSvc.test();
        }

        return status;
    }

    public getReverseAssets() {
        let assets: string[] = [];
        if(this.exchange === "BINANCE") {
            assets = [ 'BNB', 'BTC', 'ETH', 'TRX', 'XRP' ];
        }

        return assets;
    }

    public getDepth = async(pair: string) => {
        let depth: Depth = new Depth();

        if(this.exchange === "BINANCE") {
            depth = await this.binanceSvc.getDepth(pair);
        }

        return depth;
    }

    public getAvailableBalance = async(symbol:string) => {
        let balance = 0;
        if(this.exchange === "BINANCE") {
            balance = await this.binanceSvc.getAvailableBalance(symbol);
        }

        return balance;
    }

    public getPairs = async() => {
        let pairs: PriceItem[] = [];
        if(this.exchange === "BINANCE"){
            pairs = await this.binanceSvc.getPairs();
        }

        return pairs;
    }

    public placeOrder = async(pair: string, side: TradeSide, quantity: number) => {
        if(this.exchange === "BINANCE"){
            const result = await this.binanceSvc.placeMarketOrder(pair, side, quantity);

            return result;
        }
    }
}

export default ExchangeService;