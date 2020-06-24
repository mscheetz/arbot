import BinanceService from "./binance.service";
import { TradeSide } from "../classes/enums";
import { ArbitragePath } from "../classes/arbitrage-path.class";
import CoreService from "./core.service";
import { PriceItem } from "../classes/price-item.class";
import { Depth } from "../classes/depth.class";

class ArbitrageService {
    private binanceSvc: BinanceService;
    private coreSvc: CoreService;
    private pairs: PriceItem[];
    private arbitrages: ArbitragePath[][];
    private profits: ArbitragePath[][];
    private useAvailableBalance: boolean;
    private startingAmount: number;
    private triggerPercent: number;
    private depths: Depth[];
    private trade: ArbitragePath[][];
    private botOn: boolean;
    private placeTrades: boolean;
    private initialTradeValue: number;

    constructor() {
        this.binanceSvc = new BinanceService();
        this.coreSvc = new CoreService();
        this.useAvailableBalance = (typeof process.env.USE_AVAILABLE_BALANCE === 'undefined')
                                    ? false
                                    : JSON.parse(process.env.USE_AVAILABLE_BALANCE);
        this.startingAmount = (typeof process.env.INITIAL_VALUE === 'undefined')
                                ? 0
                                : +process.env.INITIAL_VALUE;
        this.triggerPercent = (typeof process.env.TRIGGER_PERCENT === 'undefined')
                                ? 0
                                : +process.env.TRIGGER_PERCENT;
        this.placeTrades = (typeof process.env.PLACE_TRADES === 'undefined')
                                    ? false
                                    : JSON.parse(process.env.PLACE_TRADES);
        this.botOn = true;
        this.initialTradeValue = this.startingAmount;
        this.arbitrages = [];
        this.depths = [];
        this.pairs = [];
        this.profits = [];
        this.trade = [];
    }

    private setDefaults() {
        this.arbitrages = [];
        this.depths = [];
        this.pairs = [];
        this.profits = [];
        this.trade = [];
    }

    public startBot = async() => {
        let i = 1;
        while(this.botOn) {
            console.info(`New bot run {${i}}`)
            this.initialTradeValue = await this.getInitValue();
            console.log(`${this.initialTradeValue}`)
            this.setDefaults();
            await this.buildInitialTrades();
            await this.arbitrageIncrement();
            await this.validateBooks();
            await this.printValid();
            if(this.placeTrades) {
                await this.executeTrades();
            }
            i++;
        }
    }

    private buildInitialTrades = async() => {
        this.pairs = await this.binanceSvc.getPairs();
        const usdts = this.pairs.filter(p => p.quoteAsset === "USDT");
        this.arbitrages = [];
        usdts.forEach(usdt => {
            let value = this.startingAmount / +usdt.price;
            value = +value.toFixed(4);
            const price = this.coreSvc.decimalCleanup(usdt.price);
            let path: ArbitragePath = {
                id: "",
                exchange: "",
                previous: "USDT",
                value: value,
                orderBookValue: 0,
                pair: usdt.pair,
                price: price,
                unit: usdt.baseAsset,
                continue: true,
                possible: false,
                bestPrice: "",
                buy: true,
                final: 0
            };
            this.arbitrages.push([path]);
        })
    }

    private arbitrageIncrement = async() => {
        let iteration = 10;
        while(iteration >0) {
            for(let i = this.arbitrages.length - 1; i >= 0; i--) {
                await this.arbitragePath(this.arbitrages[i], i);
            }
        }
    }

    private arbitragePath = async(path: ArbitragePath[], idx: number) => {
        const latestPath = path[path.length - 1];
        const startingTrade = path[0];
        const latestPair = this.pairs.filter(p => p.pair === latestPath.pair)[0];
        const initialPath = Array.from(path);
        
        if(path.length === 1 || latestPair.quoteAsset !== 'USDT') {
            const nexts = this.pairs.filter(p => (p.baseAsset == startingTrade.unit
                                                  && (p.quoteAsset === 'BNB'
                                                   || p.quoteAsset === 'BTC'
                                                   || p.quoteAsset === 'ETH'
                                                   || p.quoteAsset === 'TRX'
                                                   || p.quoteAsset === 'USDT'
                                                   || p.quoteAsset === 'XRP'))
                                                || p.pair === 'BNBUSDT'
                                                || p.pair === 'BTCUSDT'
                                                || p.pair === 'ETHUSDT'
                                                || p.pair === 'TRXUSDT'
                                                || p.pair === 'XRPUSDT');
            
            let i = 0;
            let more = true;
            if(nexts.length > 0) {
                nexts.forEach(next => {
                    let trail = Array.from(initialPath);

                    if(path.filter(p => p.pair === next.pair).length === 0
                                        && (latestPath.unit === next.baseAsset 
                                            || latestPath.unit === next.quoteAsset)){
                        more = next.quoteAsset === 'USDT' ? false : true;
                        let price = +next.price;
                        let value = latestPath.unit === next.baseAsset
                                    ? latestPath.value * price
                                    : latestPath.value / price;
                        let buy = latestPath.unit === next.baseAsset
                                    ? false : true;
                        value = next.quoteAsset === 'BTC' || next.quoteAsset[2] === 'ETH'
                                    ? +value.toFixed(8)
                                    : +value.toFixed(4);
                        price = +this.coreSvc.decimalCleanup(next.price);

                        const item: ArbitragePath = {
                            id: "",
                            exchange: "",
                            final: 0,
                            previous: latestPath.pair,
                            value: value,
                            orderBookValue: 0,
                            pair: next.pair,
                            price: price.toString(),
                            unit: next.quoteAsset,
                            continue: more,
                            possible: false,
                            bestPrice: "",
                            buy: buy
                        };
                        i++;
                        trail.push(item);
                        if(i === 1) {
                            this.arbitrages[idx] = trail;
                        } else {
                            this.arbitrages.push(trail);
                        }
                        if(!more){
                            const diffPercent = this.coreSvc.percentDiff(this.startingAmount, value);

                            if(this.coreSvc.validPercent(diffPercent, this.triggerPercent)) {
                                const uuid = this.coreSvc.getUuid();
                                trail.forEach(t => {
                                    t.id = uuid;
                                });
                                trail[0].final = value;
                                this.profits.push(trail);
                            }
                        }
                    }
                });
            } else {
                more = false;
            }
        }
    }

    private validateBooks = async() => {
        this.trade = [];
        if(this.profits.length === 0) {
            return;
        }
        await this.getBaseDepths();

        for await(const profit of this.profits) {
            await this.validatePathBooks(profit);
        }
    }

    private validatePathBooks = async(trail: ArbitragePath[]) => {
        const pairList = trail.map(t => t.pair);

        for await(const pair of pairList) {
            await this.bookValidator(trail[0].id, pair);
        }
        let valid = true;
        trail.forEach(t => {
            if(!t.possible) {
                valid = false;
            }
        });
        if(valid){
            this.trade.push(trail);
        }
    }

    private bookValidator = async(id: string, pair: string) => {
        const depth = await this.getDepth(pair);
        let path: ArbitragePath[] = this.coreSvc.getSubArray(this.profits, 'id', id);
        let thisPair = this.pairs.filter(p => p.pair)[0];
        let idx = 0;
        let trade: ArbitragePath = new ArbitragePath();
        for(idx = 0; idx < path.length; idx++){
            if(path[idx].pair === pair) {
                trade = path[idx];
                break;
            }
        }

        let buy = idx === 0
            ? true
            : path[idx - 1].unit === thisPair.baseAsset
                ? false
                : true;
        let starting = idx === 0
            ? this.startingAmount
            : path[idx - 1].value;
        const bid = +this.coreSvc.decimalCleanup(depth.bid);
        const ask = +this.coreSvc.decimalCleanup(depth.ask);
        let value = !buy
            ? starting * ask
            : starting / bid;

        value = thisPair.quoteAsset === 'BTC' || thisPair.quoteAsset === 'ETH'
            ? +value.toFixed(8)
            : +value.toFixed(4);
        
        if(trade.buy){
            if(+trade.price === ask) {
                trade.possible = true;
            }
            trade.bestPrice = ask.toString();
        } else {
            if(+trade.price === bid) {
                trade.possible = true;
            }
            trade.bestPrice = bid.toString();
        }
        trade.orderBookValue = value;
    }

    private getDepth = async(pair: string) => {
        let depth: Depth;
        const filtered = this.depths.filter(d => d.pair === pair);
        if(filtered.length === 0){
            depth = await this.binanceSvc.getDepth(pair);
            this.saveDepth(depth);
            
            return depth;
        } else {
            return filtered[0];
        }
    }

    private getBaseDepths = async() => {
        this.depths = [];
        let pairs = ['BNBUSDT', 'BTCUSDT', 'ETHUSDT', 'TRXUSDT', 'XRPUSDT'];

        for await(const pair of pairs){
            const depth = await this.binanceSvc.getDepth(pair);
            this.saveDepth(depth);
        }
    }

    private saveDepth(depth: Depth) {
        if(this.depths.filter(d => d.pair === depth.pair).length === 0) {
            this.depths.push(depth);
        }
    }

    private printValid = async() => {
        if(this.trade.length === 0 ){
            console.error(`No valid trades w/ ${this.triggerPercent}% profit.`);
            return;
        }
        console.info(`${this.trade.length} valid trades found:`);
        for(const t of this.trade) {
            let msg = `${this.startingAmount} ${t[0].previous}`;
            msg += `-> ${t[0].value} ${t[0].unit}`;
            msg += `-> ${t[1].value} ${t[1].unit}`;
            msg += `-> ${t[2].value} ${t[2].unit}`;

            console.info(msg);
        }
        console.info(`-----------------------------------`)
    }

    private getInitValue = async() => {
        let balance = 0;
        if(this.useAvailableBalance){
            balance = await this.getAvailableBalance('USDT');
        } else {
            balance = this.startingAmount;
        }

        return balance;
    }

    private getAvailableBalance = async(symbol:string) => {
        let balance = await this.binanceSvc.checkBalance(symbol);

        return balance;
    }

    private executeTrades = async() => {
        const path = this.trade[0];

        for(let i = 0; i < path.length; i++){
            const side = path[i].buy ? TradeSide.BUY : TradeSide.SELL;
            let quantity = i === 0
                ? await this.getInitValue()
                : await this.getAvailableBalance(path[i - 1].unit);

            const result = await this.placeOrder(path[i].pair, side, quantity);

            return result;
        }
    }

    private placeOrder = async(pair: string, side: TradeSide, quantity: number) => {
        const result = await this.binanceSvc.placeMarketOrder(pair, side, quantity);

        return result;
    }
}

export default ArbitrageService;