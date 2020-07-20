import * as crypto from 'crypto';
import CoreService from './core.service';
import axios from 'axios';
import { TradeSide, TradeType } from '../classes/enums';
import { PriceItem } from '../classes/price-item.class';
import { Depth } from '../classes/depth.class';
import { Balance } from '../classes/balance.class';

class KuCoinService {
    private urlBase: string = "https://api.kucoin.com";
    private apiKey: string;
    private apiSecret: string;
    private apiPassphrase: string;
    private coreSvc: CoreService;
    private makerCommission: number;
    private takerCommission: number;
    private placeTrades: boolean;

    constructor() {
        this.apiKey = (typeof process.env.KUCOIN_KEY === 'undefined')
                        ? ""
                        : process.env.KUCOIN_KEY;
        this.apiSecret = typeof process.env.KUCOIN_SECRET === 'undefined'
                        ? ""
                        : process.env.KUCOIN_SECRET;
        this.apiPassphrase = typeof process.env.KUCOIN_PASSPHRASE === 'undefined'
                        ? ""
                        : process.env.KUCOIN_PASSPHRASE;
        this.makerCommission = (typeof process.env.KUCOIN_MAKER_COMMISSION === 'undefined')
                                ? 0
                                : +process.env.KUCOIN_MAKER_COMMISSION;
        this.takerCommission = (typeof process.env.KUCOIN_TAKER_COMMISSION === 'undefined')
                                ? 0
                                : +process.env.KUCOIN_TAKER_COMMISSION;
        this.placeTrades = (typeof process.env.PLACE_TRADES === 'undefined')
                                    ? false
                                    : JSON.parse(process.env.PLACE_TRADES);
        this.coreSvc = new CoreService();
    }

    public setTradeStatus(status: boolean){
        this.placeTrades = status;

        return status;
    }

    public getTradeStatus() {
        return this.placeTrades;
    }

    public serviceReady() {
        return this.apiKey !== "" && this.apiSecret !== "";
    }

    public test = async() => {
        const endpoint = '/api/v1/status';

        const result = await this.onGet(endpoint, false);

        return result !== null;
    }

    public getCommissions() {
        return {
            maker: this.makerCommission / 100,
            taker: this.takerCommission / 100
        };
    }

    public getPairs = async() => {
        const data = await this.getExchangeInfo()
        const tickers: any[] = await this.getPrices();
        let pairs: PriceItem[] = [];

        data.forEach((symbol: any) => {
            if(symbol.enableTrading) {
                const price = tickers.filter(t => t.symbol === symbol.symbol)[0].last;
                let item = new PriceItem('KUCOIN', symbol.symbol, symbol.baseCurrency, symbol.quoteCurrency, price);
                item.basePrecision = symbol.baseMinSize;
                item.quotePrecision = symbol.quoteMinSize;
                
                if(item.basePrecision > 0) {
                    item.stepSize = this.coreSvc.getDecimals(item.basePrecision);
                }

                pairs.push(item);
            }
        });

        return pairs;
    }

    public getExchangeInfo = async() => {
        const endpoint = '/api/v1/symbols';
        const data = await this.onGet(endpoint, false);

        return data.data;
    }

    public getPrices = async() => {
        const endpoint = '/api/v1/market/allTickers';
        try {
            const data = await this.onGet(endpoint, false);

            return data.data.ticker;
        } catch(err) {
            console.error(err);
            return [];
        }
    }

    public getDepth = async(pair: string, limit: number = 20) => {
        const endpoint = `/api/v1/market/orderbook/level2_${limit}`;
        const data = {
            symbol: pair
        };
        const response = await this.onGetPlusData(endpoint, data, false);

        const depth: Depth = {
            exchange: 'KUCOIN',
            pair: pair,
            bid: response.data.bids[0][0],
            ask: response.data.asks[0][0]
        };

        return depth;
    }

    public getOrder = async(orderId: string) => {
        const endpoint = `/api/v1/orders/${orderId}`;

        const result = await this.onGet(endpoint, true);

        return result.data;
    }

    public getOrders = async(pair: string) => {
        const endpoint = '/api/v1/orders';
        let data: any = {
            status: 'active',
            symbol: pair
        };

        const result = await this.onGetPlusData(endpoint, data, true);

        return result.data;
    }

    public placeLimitOrder = async(pair: string, side: TradeSide, quantity: number, price: number) => {
        const endpoint = '/api/v1/orders';
        let params: any = {
            clientOid: this.coreSvc.getUuid(),
            side: side.toLowerCase(),
            symbol: pair,
            type: TradeType.LIMIT.toLowerCase(),
            price: price,
            size: quantity
        };
            
        const result = await this.onPost(endpoint, params, true);

        return result.data.orderId;
    }

    public placeMarketOrder = async(pair: string, side: TradeSide, quantity: number) => {
        const endpoint = '/api/v1/orders';
        let params: any = {
            clientOid: this.coreSvc.getUuid(),
            side: side.toLowerCase(),
            symbol: pair,
            type: TradeType.MARKET.toLowerCase(),
            size: quantity
        };

        const result = await this.onPost(endpoint, params, true);
        
        return result.data.orderId;
    }

    public placeMarketOrderOG = async(pair: string, side: TradeSide, quantity: number) => {
        const endpoint = '/api/v1/orders';
        let body: any = {
            symbol: pair,
            side: side,
            type: TradeType.MARKET
        };
        if(side === TradeSide.BUY) {
            body.quoteOrderQty = quantity;
        } else {
            body.quantity = quantity;
        }

        const result = await this.onPost(endpoint, body, true);

        return result.data;
    }

    public getAvailableBalances = async() => {
        const endpoint = '/api/v1/accounts';
        const data: any = {
            type: 'trade'
        }

        const response = await this.onGetPlusData(endpoint, data, true);
        
        let balances: Balance[] = [];

        response.data.forEach((bal: any) => {
            const balance: Balance = {
                symbol: bal.currency,
                quantity: bal.available
            };
            balances.push(balance);
        });

        return balances;
    }

    public getTimestamp = async() => {
        const endpoint = '/api/v3/time';

        const response = await this.onGet(endpoint, false);
        
        return response.data.serverTime;
    }

    private onGet = async(endpoint: string, secure: boolean) => {
        return this.onGetPlusData(endpoint, null, secure);
    }

    private onGetPlusData = async(endpoint: string, data: any, secure: boolean) => {
        // if(secure) {
        //     data = await this.modifyBody(data);
        // }
        let url = endpoint;
        if(data !== null) {
            const queryString = this.coreSvc.objToQueryString(data);
            url += `?${queryString}`;
        }
        let signature = "";
        if(secure) {
            signature = this.generateSignature('GET', url, null);
        }
        url = `${this.urlBase}${url}`;       

        try{
            const response = secure 
                                ? await axios.get(url, this.getSecureHeaders(signature))
                                : await axios.get(url);

            return response.data;
        } catch(err){
            console.log(err);
            return null;
        }
    } 

    public onPost = async(endpoint: string, body: any, secure: boolean = false) => {
        let url = endpoint;
        let signature = "";
        if(secure) {
            //body = await this.modifyBody(body);
            signature = this.generateSignature('POST', url, body);
        }
        url = `${this.urlBase}${url}`;

        try{
            const response = secure
                                ? await axios.post(url, body, this.getSecureHeaders(signature))
                                : await axios.post(url, body);

            return response.data;
        } catch(err){
            console.log(err);
            return null;
        }
    } 

    private getSecureHeaders(signature: string){ 
        const config = {
            headers: {
                'KC-API-KEY': this.apiKey,
                'KC-API-SIGN': signature,
                'KC-API-TIMESTAMP': new Date().getTime(),
                'KC-API-PASSPHRASE': this.apiPassphrase
            }
        };

        return config;
    }

    // private modifyBody = async(data: any) => {
    //     if(data === null) {
    //         data = {};
    //     }
    //     data.timestamp = new Date().getTime(); //await this.getTimestamp();
    //     //data.recvWindow = 5000;

    //     return data;
    // }

    private generateSignature(type: string, endpoint: string, data: any) {
        let toSign = `${new Date().getTime().toString()}${type}${endpoint}`;
        if(data !== null) {
            const jsoned = JSON.stringify(data);
            toSign += jsoned;
        }
        let signature = crypto.createHmac('sha256', this.apiSecret)
                              .update(toSign)
                              .digest('hex');

        return signature;
    }
}

export default KuCoinService;