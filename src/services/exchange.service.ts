import BinanceService from "./binance.service";
import { Depth } from "../classes/depth.class";
import { PriceItem } from "../classes/price-item.class";
import { TradeSide, OrderStatus } from "../classes/enums";
import { Balance } from "../classes/balance.class";
import CoreService from "./core.service";
import KuCoinService from "./kucoin.service";

class ExchangeService {
    private exchange: string;
    private binanceSvc: BinanceService;
    private kucoinSvc: KuCoinService;
    private coreSvc: CoreService;
    private cashOut: boolean;
    private cashOutPair: string;

    constructor(exchange: string) {
        this.exchange = exchange;
        this.binanceSvc = new BinanceService();
        this.kucoinSvc = new KuCoinService();
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

    public serviceReady(exchange: string) {
        if(exchange === "BINANCE") {
            return this.binanceSvc.serviceReady();
        } else if(exchange === "KUCOIN") {
            return this.kucoinSvc.serviceReady();
        }

        return false;
    }

    public onCashOut = async() => {
        if(!this.cashOut || this.cashOutPair === "") {
            return;
        }
        const pairs = await this.getPairs(this.exchange);
        const tradePair = pairs.filter(p => p.pair === this.cashOutPair)[0];
        let balances = await this.getAvailableBalances(this.exchange);
        const baseBalance = balances.filter(b => b.symbol === tradePair.baseAsset)[0].quantity;
        const tradeQty = this.coreSvc.roundDown(baseBalance, tradePair.stepSize);

        this.displayBalances(tradePair, balances);
        console.log(`Ready to sell ${tradeQty} ${tradePair.baseAsset} to ${tradePair.quoteAsset}`);

        if(baseBalance > 0) {
            const response = await this.placeMarketOrder(this.exchange, this.cashOutPair, TradeSide.SELL, tradeQty);
            console.log(`response`, response);
        }

        balances = await this.getAvailableBalances(this.exchange);
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

        const orders = await this.getOrders(this.exchange, pair);
        console.log(orders);

        return true;
    }

    public getTradeStatus(exchange: string) {
        let status = false;
        if(exchange === "BINANCE") {
            status = this.binanceSvc.getTradeStatus();
        } else if (exchange === "KUCOIN") {
            status = this.kucoinSvc.getTradeStatus();
        }
        return status;
    }

    public setTradeStatus(exchange: string, status: boolean) {
        if(exchange === "BINANCE") {
            this.binanceSvc.setTradeStatus(status);
        } else if (exchange === "KUCOIN") {
            this.kucoinSvc.setTradeStatus(status);
        }
        
        return this.getTradeStatus(exchange);
    }

    public test = async(exchange: string) => {
        let status = false;

        if(exchange === "BINANCE") {
            status = await this.binanceSvc.test();
        } else if (exchange === "KUCOIN") {
            status = await this.kucoinSvc.test();
        }

        return status;
    }

    public getReverseAssets(exchange: string) {
        let assets: string[] = [];
        if(exchange === "BINANCE") {
            assets = [ 'BNB', 'BTC', 'ETH', 'TRX', 'XRP' ];
        } else if (exchange === "KUCOIN") {
            assets = [ 'BNB', 'BTC', 'ETH', 'KCS', 'NEO', 'TRX' ]
        }

        return assets;
    }

    public getDepth = async(exchange: string, pair: string) => {
        let depth: Depth = new Depth();

        if(exchange === "BINANCE") {
            depth = await this.binanceSvc.getDepth(pair);
        } else if(exchange === "KUCOIN") {
            depth = await this.kucoinSvc.getDepth(pair);
        }

        return depth;
    }

    public getAvailableBalance = async(exchange: string, symbol:string) => {
        let balance = 0;
        const balances = await this.getAvailableBalances(exchange);

        if(balances.length > 0) {
            const assetBalance = balances.filter(b => b.symbol === symbol);

            if(assetBalance.length > 0){
                balance = assetBalance[0].quantity;
            }
        }

        return balance;
    }

    public getAvailableBalances = async(exchange: string) => {
        let balances: Balance[] = []
        if(exchange === "BINANCE") {
            balances = await this.binanceSvc.getAvailableBalances();
        } else if(exchange === "KUCOIN") {
            balances = await this.kucoinSvc.getAvailableBalances();
        }

        return balances;
    }

    public getPairs = async(exchange: string) => {
        let pairs: PriceItem[] = [];
        if(exchange === "BINANCE"){
            pairs = await this.binanceSvc.getPairs();
        } else if(exchange === "KUCOIN"){
            pairs = await this.kucoinSvc.getPairs();
        }

        return pairs;
    }

    public getOrder = async(exchange: string, pair: string, clientOrderId: string) => {
        let order: any;
        if(exchange === "BINANCE"){
            order = await this.binanceSvc.getOrder(pair, clientOrderId);
        } else if(exchange === "KUCOIN"){
            order = await this.kucoinSvc.getOrder(clientOrderId);
        }

        return order;
    }

    public getOrders = async(exchange: string, pair: string) => {
        let orders: any[] = [];
        if(exchange === "BINANCE"){
            orders = await this.binanceSvc.getOrders(pair);
        } else if(exchange === "KUCOIN"){
            orders = await this.kucoinSvc.getOrders(pair);
        }

        return orders;
    }

    public getCommissions(exchange: string) {
        let commissions: any = {}
        if(exchange === "BINANCE"){
            commissions = this.binanceSvc.getCommissions();
        } else if(exchange === "KUCOIN"){
            commissions = this.kucoinSvc.getCommissions();
        }

        return commissions;
    }

    public checkOrderStatus = async(exchange: string, pair: string, orderId: string) => {
        const order = await this.getOrder(exchange, pair, orderId);

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

    public placeLimitOrder = async(exchange: string, pair: string, side: TradeSide, quantity: number, price: number) => {
        let result: any;
        if(exchange === "BINANCE"){
            result = await this.binanceSvc.placeLimitOrder(pair, side, quantity, price);
        } else if(exchange === "KUCOIN"){
            result = await this.kucoinSvc.placeLimitOrder(pair, side, quantity, price);
        }

        return result;
    }

    public placeMarketOrder = async(exchange: string, pair: string, side: TradeSide, quantity: number) => {
        let result: any;
        if(exchange === "BINANCE"){
            result = await this.binanceSvc.placeMarketOrder(pair, side, quantity);
        } else if(exchange === "KUCOIN"){
            result = await this.kucoinSvc.placeMarketOrder(pair, side, quantity);
        }

        return result;
    }
}

export default ExchangeService;