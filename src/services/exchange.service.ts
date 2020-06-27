import BinanceService from "./binance.service";
import { Depth } from "../classes/depth.class";
import { PriceItem } from "../classes/price-item.class";
import { TradeSide, OrderStatus } from "../classes/enums";
import { Balance } from "../classes/balance.class";
import CoreService from "./core.service";

class ExchangeService {
    private exchange: string;
    private binanceSvc: BinanceService;
    private coreSvc: CoreService;
    private cashOut: boolean;
    private cashOutPair: string;

    constructor(exchange: string) {
        this.exchange = exchange;
        this.binanceSvc = new BinanceService();
        this.coreSvc = new CoreService();
        this.cashOut = (typeof process.env.CASH_OUT === 'undefined')
                                    ? false
                                    : JSON.parse(process.env.CASH_OUT);
        this.cashOutPair = (typeof process.env.CASH_OUT_PAIR === 'undefined')
                                    ? ""
                                    : process.env.CASH_OUT_PAIR;
        this.onCashOut()
            .then(() => {});
    }

    public serviceReady() {
        if(this.exchange === "BINANCE") {
            return this.binanceSvc.serviceReady();
        }

        return false;
    }

    public onCashOut = async() => {
        if(!this.cashOut || this.cashOutPair === "") {
            return;
        }
        const pairs = await this.getPairs();
        const tradePair = pairs.filter(p => p.pair === this.cashOutPair)[0];
        let balances = await this.getAvailableBalances();
        const baseBalance = balances.filter(b => b.symbol === tradePair.baseAsset)[0].quantity;
        const tradeQty = this.coreSvc.roundDown(baseBalance, tradePair.stepSize);

        this.displayBalances(tradePair, balances);
        console.log(`Ready to sell ${tradeQty} ${tradePair.baseAsset} to ${tradePair.quoteAsset}`);

        if(baseBalance > 0) {
            const response = await this.placeMarketOrder(this.cashOutPair, TradeSide.SELL, tradeQty);
            console.log(`response`, response);
        }

        balances = await this.getAvailableBalances();
        this.displayBalances(tradePair, balances);
        console.log('Cashed out');
    }

    private displayBalances(tradePair: PriceItem, balances: Balance[]) {
        const baseBalance = balances.filter(b => b.symbol === tradePair.baseAsset)[0].quantity;
        const quoteBalance = balances.filter(b => b.symbol === tradePair.quoteAsset)[0].quantity;

        console.log(`Current ${tradePair.baseAsset} balance: ${baseBalance}`);
        console.log(`Current ${tradePair.quoteAsset} balance: ${quoteBalance}`);
    }

    public checkOrders = async() => {
        const pair = "BTCUSDT";

        const orders = await this.getOrders(pair);
        console.log(orders);

        return true;
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
        const balances = await this.getAvailableBalances();

        if(balances.length > 0) {
            const assetBalance = balances.filter(b => b.symbol === symbol);

            if(assetBalance.length > 0){
                balance = assetBalance[0].quantity;
            }
        }

        return balance;
    }

    public getAvailableBalances = async() => {
        let balances: Balance[] = []
        if(this.exchange === "BINANCE") {
            balances = await this.binanceSvc.getAvailableBalances();
        }

        return balances;
    }

    public getPairs = async() => {
        let pairs: PriceItem[] = [];
        if(this.exchange === "BINANCE"){
            pairs = await this.binanceSvc.getPairs();
        }

        return pairs;
    }

    public getOrder = async(pair: string, clientOrderId: string) => {
        let order: any;
        if(this.exchange === "BINANCE"){
            order = await this.binanceSvc.getOrder(pair, clientOrderId);
        }

        return order;
    }

    public getOrders = async(pair: string) => {
        let orders: any[] = [];
        if(this.exchange === "BINANCE"){
            orders = await this.binanceSvc.getOrders(pair);
        }

        return orders;
    }

    public checkOrderStatus = async(pair: string, orderId: string) => {
        const order = await this.getOrder(pair, orderId);

        let status = OrderStatus.NONE;

        if(order.status === "FILLED") {
            status = OrderStatus.FILLED;
        } else if (order.status === "NEW" || order.status === "PARTIALLY_FILLED") {
            status = OrderStatus.OPEN;
        } else {
            status = OrderStatus.CANCELED;
        }

        return status;
    }

    public placeLimitOrder = async(pair: string, side: TradeSide, quantity: number, price: number) => {
        if(this.exchange === "BINANCE"){
            let result = await this.binanceSvc.placeLimitOrder(pair, side, quantity, price);

            return result;
        }
    }

    public placeMarketOrder = async(pair: string, side: TradeSide, quantity: number) => {
        if(this.exchange === "BINANCE"){
            let result = await this.binanceSvc.placeMarketOrder(pair, side, quantity);

            return result;
        }
    }
}

export default ExchangeService;