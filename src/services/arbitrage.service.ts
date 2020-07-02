import { TradeSide, OrderStatus, LogLevel } from "../classes/enums";
import { ArbitragePath } from "../classes/arbitrage-path.class";
import CoreService from "./core.service";
import { PriceItem } from "../classes/price-item.class";
import { Depth } from "../classes/depth.class";
import ExchangeService from "./exchange.service";

class ArbitrageService {
    private exchangeSvc: ExchangeService;
    private exchange: string;
    private coreSvc: CoreService;
    private pairs: PriceItem[];
    private arbitrages: ArbitragePath[][];
    private reverseArbitrages: ArbitragePath[][];
    private profits: ArbitragePath[][];
    private tradeProfits: boolean;
    private startingAmount: number;
    private triggerPercent: number;
    private depths: Depth[];
    private trades: ArbitragePath[][];
    private botOn: boolean;
    private closeBot: boolean;
    private placeTrades: boolean;
    private bestPath: ArbitragePath[];
    private reverseAssets: string[];
    private runPause: number;
    private orderCanceled: boolean;
    private orderCheckTimeout: number;
    private makerCommission: number;
    private takerCommission: number;
    private logLevel: LogLevel;
    private botRun: number;

    constructor() {
        this.coreSvc = new CoreService();
        this.exchange = (typeof process.env.EXCHANGE === 'undefined')
                        ? ""
                        : process.env.EXCHANGE;
        this.tradeProfits = (typeof process.env.TRADE_PROFITS === 'undefined')
                                    ? false
                                    : JSON.parse(process.env.TRADE_PROFITS);
        this.startingAmount = (typeof process.env.INITIAL_VALUE === 'undefined')
                                ? 0
                                : +process.env.INITIAL_VALUE;
        this.triggerPercent = (typeof process.env.TRIGGER_PERCENT === 'undefined')
                                ? 0
                                : +process.env.TRIGGER_PERCENT;
        this.placeTrades = (typeof process.env.PLACE_TRADES === 'undefined')
                                    ? false
                                    : JSON.parse(process.env.PLACE_TRADES);
        this.botOn = (typeof process.env.RUN_BOT === 'undefined')
                            ? true
                            : JSON.parse(process.env.RUN_BOT);
        this.runPause = (typeof process.env.RUN_PAUSE_SECONDS === 'undefined')
                                ? 0
                                : +process.env.RUN_PAUSE_SECONDS;
        this.orderCheckTimeout = (typeof process.env.ORDER_CHECK_SECONDS === 'undefined')
                                ? 0
                                : +process.env.ORDER_CHECK_SECONDS;
        this.makerCommission = (typeof process.env.MAKER_COMMISSION === 'undefined')
                                ? 0
                                : +process.env.MAKER_COMMISSION;
        this.takerCommission = (typeof process.env.TAKER_COMMISSION === 'undefined')
                                ? 0
                                : +process.env.TAKER_COMMISSION;
        const logLevel: string = (typeof process.env.LOG_LEVEL === 'undefined')
                                ? "DEBUG"
                                : process.env.LOG_LEVEL;
        this.logLevel = (<any>LogLevel)[logLevel];
        console.log(`Logging set to ${this.logLevel}`);
        if(this.exchange === "") {
            console.error(`EXCHANGE not identified in config. Bot cannot run`);
            this.closeBot = true;
        } else {
            console.log(`Exchange set: ${this.exchange}`);
        }
        this.exchangeSvc = new ExchangeService(this.exchange);
        if(this.placeTrades && !this.exchangeSvc.serviceReady()) {
            console.error(`Exchange API key/secret not set correctly. No trades will be executed.`);
            this.placeTrades = false;
        }
        this.checkConnection();
        this.balanceCheck();
        this.getCommissions();
        this.botRun = 0;
        if(this.closeBot) {
            this.onCloseBot();
        }
    }

    private setDefaults() {
        this.arbitrages = [];
        this.reverseArbitrages = [];
        this.depths = [];
        this.pairs = [];
        this.profits = [];
        this.trades = [];
        this.bestPath = [];
        this.orderCanceled = false;
        this.reverseAssets = this.exchangeSvc.getReverseAssets();
    }

    public startBot = async() => {
        this.botRun = 1;
        while(this.botOn) {
            this.checkConnection();
            if(this.closeBot) {
                console.error('Cannot connect to exchange');
                this.onCloseBot();
            }
            if(this.logLevel === LogLevel.DEBUG) {
                console.info(`New bot run {${this.botRun}}`);
            }
            //this.initialTradeValue = await this.getInitValue();
            this.setDefaults();
            await this.buildInitialTrades();
            await this.arbitrageIncrement();
            await this.validateBooks();
            await this.printValid();
            if(this.placeTrades) {
                await this.executeTrades();
            }
            if(this.bestPath.length === 0) {
                if(this.logLevel === LogLevel.DEBUG) {
                    console.log(`Pausing for ${this.runPause} seconds`);
                }
                await this.coreSvc.sleep(this.runPause);
            }
            this.botRun++;
        }
    }

    public toggleBot() {
        this.botOn = !this.botOn;
    }

    private buildInitialTrades = async() => {
        if(this.logLevel === LogLevel.DEBUG) {
            console.log(`Building initial trades`);
        }
        this.pairs = await this.exchangeSvc.getPairs();
        const usdts = this.pairs.filter(p => p.quoteAsset === "USDT");
        this.arbitrages = [];
        usdts.forEach(usdt => {
            let value = this.startingAmount / +usdt.price;
            value = +value.toFixed(4);
            const price = this.coreSvc.decimalCleanup(usdt.price);
            const uuid = this.coreSvc.getUuid();
            let path: ArbitragePath = {
                id: uuid,
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
                final: 0,
                tradeQuantity: 0,
                fee: 0,
                feeUnit: ""
            };
            if(this.reverseAssets.indexOf(usdt.baseAsset) >= 0) {
                this.reverseArbitrages.push([path]);
            } else {
                this.arbitrages.push([path]);
            }

        });
        if(this.logLevel === LogLevel.DEBUG) {
            console.log(`${this.arbitrages.length + this.reverseArbitrages.length} entry points established`);
        }
    }

    private arbitrageIncrement = async() => {
        if(this.logLevel === LogLevel.DEBUG) {
            console.log(`Incrementing through trade paths`);
        }
        let iteration = 10;
        while(iteration > 0) {
            for(let i = this.arbitrages.length - 1; i >= 0; i--) {
                await this.arbitragePath(this.arbitrages[i], i);
            }
            for(let i = this.reverseArbitrages.length - 1; i >= 0; i--) {
                await this.reverseArbitragePath(this.reverseArbitrages[i], i);
            }
            iteration--;
        }
        if(this.logLevel === LogLevel.DEBUG) {
            console.log(`${this.arbitrages.length + this.reverseArbitrages.length} arbitrage paths`);
            console.log(`${this.profits.length} possible profitable paths`);
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
                    let exists = this.pathExists(path, next, false);

                    if(!exists && path.filter(p => p.pair === next.pair).length === 0
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
                        let priceStr = this.coreSvc.decimalCleanup(next.price);

                        i++;
                        const uuid = i === 1 ? trail[0].id : this.coreSvc.getUuid();
                        
                        const item: ArbitragePath = {
                            id: uuid,
                            exchange: "",
                            final: 0,
                            previous: latestPath.pair,
                            value: value,
                            orderBookValue: 0,
                            pair: next.pair,
                            price: priceStr,
                            unit: next.quoteAsset,
                            continue: more,
                            possible: false,
                            bestPrice: "",
                            buy: buy,
                            tradeQuantity: 0,
                            fee: 0,
                            feeUnit: ""
                        };
                        //i++;
                        if(i === 1) {
                            trail.push(item);
                            this.arbitrages[idx] = trail;
                        } else {
                            let newTrail: ArbitragePath[] = [];
                            for(let j = 0; j < trail.length; j++) {
                                let trailItem: ArbitragePath = {
                                    id: uuid,
                                    exchange: "",
                                    final: trail[j].final,
                                    previous: trail[j].previous,
                                    value: trail[j].value,
                                    orderBookValue: trail[j].orderBookValue,
                                    pair: trail[j].pair,
                                    price: trail[j].price,
                                    unit: trail[j].unit,
                                    continue: trail[j].continue,
                                    possible: trail[j].possible,
                                    bestPrice: trail[j].bestPrice,
                                    buy: trail[j].buy,
                                    tradeQuantity: 0,
                                    fee: 0,
                                    feeUnit: ""
                                }
                                newTrail.push(trailItem);
                            }
                            newTrail.push(item);
                            this.arbitrages.push(newTrail);
                        }
                        if(!more){
                            const validTrade = this.coreSvc.validateTrade(this.startingAmount, value, this.triggerPercent);

                            if(validTrade) {
                                const uuid = this.coreSvc.getUuid();
                                trail.forEach(t => {
                                    t.id = uuid;
                                });
                                trail[0].final = value;
                                this.profits.push(trail);
                                if(this.logLevel === LogLevel.DEBUG) {
                                    console.log(`Potential trade found: '${trail[0].pair}' --> '${trail[trail.length - 1].pair}' = ${trail[trail.length - 1].value}`);
                                }
                            }
                        }
                    }
                });
            } else {
                more = false;
            }
        }
    }

    private reverseArbitragePath = async(path: ArbitragePath[], idx: number) => {
        const latestPath = path[path.length - 1];
        const latestPair = this.pairs.filter(p => p.pair === latestPath.pair)[0];
        const initialPath = Array.from(path);
        
        if(path.length === 1 || latestPair.quoteAsset !== 'USDT') {
            const nexts = path.length === 1
                            ? this.getReversePairs(latestPair.baseAsset)
                            : this.pairs.filter(p => p.baseAsset === latestPair.baseAsset 
                                                 && p.quoteAsset === 'USDT');
            
            let i = 0;
            let more = true;
            if(nexts.length > 0) {
                nexts.forEach(next => {
                    let trail = Array.from(initialPath);
                    let exists = this.pathExists(path, next, true);

                    if(!exists && path.filter(p => p.pair === next.pair).length === 0
                                        && (latestPath.unit === next.baseAsset 
                                         || latestPath.unit === next.quoteAsset)){
                        more = next.quoteAsset === 'USDT' ? false : true;
                        let price = +next.price;
                        let value = latestPath.unit === next.baseAsset
                                    ? latestPath.value * price
                                    : latestPath.value / price;
                        let buy = latestPath.unit === next.baseAsset
                                    ? false : true;
                        let asset = buy ? next.baseAsset : next.quoteAsset;
                        value = next.quoteAsset === 'BTC' || next.quoteAsset[2] === 'ETH'
                                    ? +value.toFixed(8)
                                    : +value.toFixed(4);
                        let priceStr = this.coreSvc.decimalCleanup(next.price);

                        i++;
                        const uuid = i === 1 ? trail[0].id : this.coreSvc.getUuid();
                        const item: ArbitragePath = {
                            id: uuid,
                            exchange: "",
                            final: 0,
                            previous: latestPath.pair,
                            value: value,
                            orderBookValue: 0,
                            pair: next.pair,
                            price: priceStr,
                            unit: asset,
                            continue: more,
                            possible: false,
                            bestPrice: "",
                            buy: buy,
                            tradeQuantity: 0,
                            fee: 0,
                            feeUnit: ""
                        };
                        i++;
                        let validTrail: ArbitragePath[] = [];
                        if(i === 1) {
                            trail.push(item);
                            this.reverseArbitrages[idx] = trail;
                            validTrail = trail;
                        } else {
                            let newTrail: ArbitragePath[] = [];
                            for(let j = 0; j < trail.length; j++) {
                                let trailItem: ArbitragePath = {
                                    id: uuid,
                                    exchange: "",
                                    final: trail[j].final,
                                    previous: trail[j].previous,
                                    value: trail[j].value,
                                    orderBookValue: trail[j].orderBookValue,
                                    pair: trail[j].pair,
                                    price: trail[j].price,
                                    unit: trail[j].unit,
                                    continue: trail[j].continue,
                                    possible: trail[j].possible,
                                    bestPrice: trail[j].bestPrice,
                                    buy: trail[j].buy,
                                    tradeQuantity: 0,
                                    fee: 0,
                                    feeUnit: ""
                                }
                                newTrail.push(trailItem);
                            }
                            newTrail.push(item);
                            this.reverseArbitrages.push(newTrail);
                            validTrail = newTrail;
                        }
                        if(!more){
                            const validTrade = this.coreSvc.validateTrade(this.startingAmount, value, this.triggerPercent);

                            if(validTrade) {
                                const uuid = this.coreSvc.getUuid();
                                validTrail.forEach(t => {
                                    t.id = uuid;
                                });
                                validTrail[0].final = value;
                                this.profits.push(validTrail);
                                if(this.logLevel === LogLevel.DEBUG) {
                                    console.log(`Potential trade found: '${validTrail[0].pair}' --> '${validTrail[validTrail.length - 1].pair}' = ${validTrail[validTrail.length - 1].value}`);
                                }
                            }
                        }
                    }
                });
            } else {
                more = false;
            }
        }
    }

    private pathExists(path: ArbitragePath[], next: PriceItem, reverse: boolean): boolean {
        let exists = false;
        const items = reverse ? this.reverseArbitrages : this.arbitrages;

        for(let j = 0; j < items.length; j++) {
            let matches = 0;
            if(items[j].length > path.length) {
                for(let i = 0; i < path.length + 1; i++) {
                    if(i > (path.length - 1)) {
                        if(next.pair === items[j][i].pair) {
                            matches++;
                        }
                    } else {
                        if(path[i].pair === items[j][i].pair) {
                            matches++;
                        }
                    }
                }
            }
            if(matches === (path.length + 1)) {
                exists = true;
                break;
            }
        }

        return exists;
    }

    private validateBooks = async() => {
        this.trades = [];
        if(this.profits.length === 0) {
            return;
        }
        if(this.logLevel === LogLevel.DEBUG) {
            console.log(`Validating order books`);
        }
        await this.getBaseDepths();

        for await(const profit of this.profits) {
            await this.validatePathBooks(profit);
        }
    }

    private validatePathBooks = async(trail: ArbitragePath[]) => {
        if(this.logLevel === LogLevel.DEBUG) {
            console.log(`Validating order book of ${trail[0].pair} => ${trail[trail.length -1].pair}`);
        }
        const pairList = trail.map(t => t.pair);

        for await(const pair of pairList) {
            await this.bookValidator(trail[0].id, pair);
        }
        const valid = this.coreSvc.validateTrade(this.startingAmount, trail[trail.length - 1].orderBookValue, this.triggerPercent);

        if(valid){
            if(this.logLevel === LogLevel.DEBUG) {
                console.log(`Valid Trade: ${trail[0].pair} => ${trail[trail.length -1].pair} --> ${trail[trail.length -1].orderBookValue}`);
            }
            this.trades.push(trail);
        } else {
            if(this.logLevel === LogLevel.DEBUG) {
                console.log('Invalid Trade:');
                this.printPath(trail);
            }
            //console.log(`Invalid Trade: ${trail[0].pair} => ${trail[trail.length -1].pair} --> ${trail[trail.length -1].orderBookValue}`);
        }
    }

    private bookValidator = async(id: string, pair: string) => {
        const depth = await this.depthDive(pair);
        let path: ArbitragePath[] = this.coreSvc.getSubArray(this.profits, 'id', id);
        let thisPair = this.pairs.filter(p => p.pair === pair)[0];
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
            : path[idx - 1].orderBookValue;
        const bid = (+depth.bid).toFixed(8);// +this.coreSvc.decimalCleanup(depth.bid);
        const ask = (+depth.ask).toFixed(8);//+this.coreSvc.decimalCleanup(depth.ask);
        let value = buy
            ? starting / +ask
            : starting * +bid;

        // const commission = value * this.takerCommission;
        // console.log(`commission: ${commission} ${trade.unit}`);

        value = thisPair.quoteAsset === 'BTC' || thisPair.quoteAsset === 'ETH'
            ? +value.toFixed(8)
            : +value.toFixed(4);
        
        if(trade.buy){
            if(trade.price === ask) {
                trade.possible = true;
            }
            trade.bestPrice = ask;
        } else {
            if(trade.price === bid) {
                trade.possible = true;
            }
            trade.bestPrice = bid;
        }
        trade.orderBookValue = value;
    }

    private depthDive = async(pair: string) => {
        let depth: Depth;
        const filtered = this.depths.filter(d => d.pair === pair);
        if(filtered.length === 0){
            depth = await this.exchangeSvc.getDepth(pair);
            this.saveDepth(depth);
            
            return depth;
        } else {
            return filtered[0];
        }
    }

    private getBaseDepths = async() => {
        this.depths = [];
        let pairs = ['BNBUSDT', 'BTCUSDT', 'ETHUSDT', 'TRXUSDT', 'XRPUSDT'];

        for (let i = 0; i < pairs.length; i++){
            const depth = await this.exchangeSvc.getDepth(pairs[i]);
            this.saveDepth(depth);
        }
    }

    private saveDepth(depth: Depth) {
        if(this.depths.filter(d => d.pair === depth.pair).length === 0) {
            this.depths.push(depth);
        }
    }

    private printValid = async() => {
        if(this.trades.length === 0 ){
            console.error(`{${this.botRun} No valid trades w/ ${this.triggerPercent}%+ profit.`);
            return;
        }
        if(this.logLevel === LogLevel.DEBUG) {
            console.info(`${this.trades.length} valid trades found:`);
        }
        let maxValue = 0;
        for(const t of this.trades) {            
            if(this.logLevel === LogLevel.DEBUG) {
                this.printPath(t);
            }
            
            if(t[t.length - 1].orderBookValue > maxValue) {
                maxValue = t[t.length - 1].orderBookValue;
                this.bestPath = t;
            }
        }        
        if(this.logLevel === LogLevel.DEBUG) {
            console.info(`-----------------------------------`);
        }
        console.log(`Best trade:`);
        this.printPath(this.bestPath);        
        if(this.logLevel === LogLevel.DEBUG) {
            console.info(`-----------------------------------`);
        }
    }

    private printPath(path: ArbitragePath[]) {
        let msg = `${this.startingAmount} ${path[0].previous}`;
        for(let i = 0; i < path.length; i++) {
            msg += `-> ${path[i].orderBookValue} ${path[i].unit} (${path[i].bestPrice})`;
        }

        console.log(msg);

        return;
    }

    private getInitValue = async() => {
        let balance = 0;
        if(this.tradeProfits){
            balance = await this.exchangeSvc.getAvailableBalance('USDT');
        } else {
            balance = this.startingAmount;
        }

        return balance;
    }
    private executeTrades = async() => {
        if(this.bestPath.length === 0) {
            console.log('No profitable trades available to trade');
            return;
        }

        for(let i = 0; i < this.bestPath.length; i++){
            const side = this.bestPath[i].buy ? TradeSide.BUY : TradeSide.SELL;
            let quantity = i === 0
                ? await this.getInitValue()
                : await this.exchangeSvc.getAvailableBalance(this.bestPath[i - 1].unit);

            if(quantity === 0){
                console.log(`Insufficient ${this.bestPath[i - 1].unit} balance: '${quantity}'`);
                return;
            }

            const thisPair = this.pairs.filter(p => p.pair === this.bestPath[i].pair)[0];
            const decimalPlaces = side === TradeSide.BUY 
                                    ? thisPair.stepSize
                                    : thisPair.quotePrecision;
        
            let tradeQty = i === 0
                        ? this.bestPath[i].value
                        : quantity;

            tradeQty = this.coreSvc.roundDown(this.bestPath[i].value, decimalPlaces);

            const result = await this.exchangeSvc.placeLimitOrder(this.bestPath[i].pair, side, tradeQty, +this.bestPath[i].bestPrice);
            //await this.exchangeSvc.placeMarketOrder(this.bestPath[i].pair, side, tradeQty);

            await this.checkOrderStatus(this.bestPath[i].pair, result.status);

            if(this.orderCanceled) {
                console.error(`Trade canceled: ${this.bestPath[i].pair} ${side} ${tradeQty}`);
                console.log('Log into your exchange and start over');
                this.botOn = false;
                this.onCloseBot();
                break;
            }

            console.log(`Trade excecuted: ${this.bestPath[i].pair} ${side} ${tradeQty}`);
        }
    }

    private checkOrderStatus = async(pair: string, orderId: string) => {
        let checkOn = true;
        let checkNumber = 1;

        while(checkOn) {
            const status = await this.exchangeSvc.checkOrderStatus(pair, orderId);

            if(status === OrderStatus.FILLED) {
                checkOn = false;
            } else if (status === OrderStatus.CANCELED) {
                this.orderCanceled = true;
                checkOn = false;
            } else {
                console.log(`{${checkNumber}} ${pair} order not filled. Re-check status in ${this.orderCheckTimeout} seconds.`)
                await this.coreSvc.sleep(this.orderCheckTimeout);
            }
            checkNumber++;
        }
    }

    private getReversePairs(quoteAsset: string) {
        const subSet = this.pairs.filter(p => p.quoteAsset === quoteAsset);
        const coins = this.pairs.filter(p => p.quoteAsset === 'USDT').map(p => p.baseAsset);
        let pairs: PriceItem[] = [];

        subSet.forEach(sub => {
            if(coins.indexOf(sub.baseAsset) >= 0) {
                pairs.push(sub);
            }
        });

        return pairs;
    }

    private balanceCheck(){
        this.exchangeSvc.getAvailableBalance('USDT')
            .then(bal => {
                if(bal < this.startingAmount){
                    console.error(`Insufficient 'USDT' balance to start bot: ${bal}`);
                    console.error('No trades will be executed');
                    this.placeTrades = false;
                }
            })
            .catch(err => {
                console.log(err);
                this.placeTrades = false;
            });
    }

    private getCommissions() {
        const commissions = this.exchangeSvc.getCommissions();
        this.makerCommission = commissions.maker;
        this.takerCommission = commissions.taker;
        console.log(`maker: '${this.makerCommission}' taker: '${this.takerCommission}'`);
    }

    private checkConnection() {
        this.exchangeSvc.test()
            .then(res => {
                this.botOn = res;
                this.closeBot = !this.botOn;
            });
    }

    private onCloseBot() {
        console.error('Arbot is closing.');
        console.error('Peace out!');
        process.exit();
    }
}

export default ArbitrageService;