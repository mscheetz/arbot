import BinanceService from "./binance.service";
import * as dotenv from 'dotenv';
import { TradeSide } from "../classes/enums";

class ArbitrageService {
    private binanceSvc: BinanceService;

    constructor() {
        this.binanceSvc = new BinanceService();
    }

    public startBot(){

    }

    private arbitrageCheck(){

    }

    private orderBookCheck() {

    }

    private placeOrder = async(pair: string, side: TradeSide, quantity: number) => {
        const result = await this.binanceSvc.placeMarketOrder(pair, side, quantity);
    }
}

export default ArbitrageService;