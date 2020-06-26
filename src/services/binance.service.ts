import * as crypto from 'crypto';
import CoreService from './core.service';
import axios from 'axios';
import { TradeSide, TradeType } from '../classes/enums';
import { PriceItem } from '../classes/price-item.class';
import { Depth } from '../classes/depth.class';
import { Balance } from '../classes/balance.class';

class BinanceService {
    private urlBase: string = "https://binance.com/api";
    private apiKey: string;
    private apiSecret: string;
    private coreSvc: CoreService;

    constructor() {
        this.apiKey = (typeof process.env.BINANCE_KEY === 'undefined')
                        ? ""
                        : process.env.BINANCE_KEY;
        this.apiSecret = typeof process.env.BINANCE_SECRET === 'undefined'
                        ? ""
                        : process.env.BINANCE_SECRET;
        this.coreSvc = new CoreService();
    }

    public serviceReady() {
        return this.apiKey !== "" && this.apiSecret !== "";
    }

    public test = async() => {
        const endpoint = '/v3/ping';

        const result = await this.onGet(endpoint, false);

        return result !== null;
    }

    public getPairs = async() => {
        const data = await this.getExchangeInfo()
        const tickers: any[] = await this.getPrices();
        let pairs: PriceItem[] = [];

        data.symbols.forEach((symbol: any) => {
            if(symbol.status === "TRADING") {
                const price = tickers.filter(t => t.symbol === symbol.symbol)[0].price;
                let item = new PriceItem(symbol.symbol, symbol.baseAsset, symbol.quoteAsset, price);
                pairs.push(item);
            }
        });

        return pairs;
    }

    public getExchangeInfo = async() => {
        const endpoint = '/v3/exchangeInfo';
        const data = await this.onGet(endpoint, false);

        return data;
    }

    public getPrices = async() => {
        const endpoint = '/v3/ticker/price';
        const data = await this.onGet(endpoint, false);

        return data;
    }

    public getDepth = async(pair: string, limit: number = 5) => {
        const endpoint = `/v3/depth`;
        const data = {
            symbol: pair,
            limit: limit
        };
        const response = await this.onGetPlusData(endpoint, data, false);

        const depth: Depth = {
            pair: pair,
            bid: response.bids[0][0],
            ask: response.asks[0][0]
        };

        return depth;
    }

    public placeMarketOrder = async(pair: string, side: TradeSide, quantity: number) => {
        const endpoint = '/v3/order';
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

        const result = await this.onPost(endpoint, body, true, true);

        return result;
    }

    public getAvailableBalances = async() => {
        const data = await this.getAccountInfo();
        let balances: Balance[] = [];

        data.balances.forEach((bal: any) => {
            const balance: Balance = {
                symbol: bal.asset,
                quantity: bal.free
            };
            balances.push(balance);
        });

        return balances;
    }

    public getAccountInfo = async() => {
        const endpoint = '/v3/account';

        const response = await this.onGet(endpoint, true);
        
        return response;
    }

    public getTimestamp = async() => {
        const endpoint = '/v3/time';

        const response = await this.onGet(endpoint, false);
        
        return response.serverTime;
    }

    private onGet = async(endpoint: string, secure: boolean) => {
        return this.onGetPlusData(endpoint, null, secure);
    }

    private onGetPlusData = async(endpoint: string, data: any, secure: boolean) => {
        if(secure) {
            data = await this.modifyBody(data);
        }
        let url = `${this.urlBase}${endpoint}`;
        if(data !== null) {
            const queryString = this.coreSvc.objToQueryString(data);
            url += `?${queryString}`;
        }
        if(secure) {
            const signature = this.generateSignature(data);
            url += `&signature=${signature}`;
        }
        

        try{
            const response = secure 
                                ? await axios.get(url, this.getRequestConfig())
                                : await axios.get(url);

            return response.data;
        } catch(err){
            console.log(err);
            return null;
        }
    } 

    public onPost = async(endpoint: string, body: any, secure: boolean = false, noRequestData: boolean = false) => {
        let url = `${this.urlBase}${endpoint}`;
        if(secure) {
            body = await this.modifyBody(body);
            const signature = this.generateSignature(body);
            body.signature = signature;
            if(noRequestData) {
                const queryString = this.coreSvc.objToQueryString(body);
                url += `?${queryString}`;
                body = null;
            }
            //url += `?signature=${signature}`;
        }

        try{
            const response = secure
                                ? await axios.post(url, body, this.getRequestConfig())
                                : await axios.post(url, body);

            return response.data;
        } catch(err){
            console.log(err);
            return null;
        }
    } 

    private getRequestConfig(){ 
        const config = {
            headers: {
                'X-MBX-APIKEY': this.apiKey,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        return config;
    }

    private modifyBody = async(data: any) => {
        if(data === null) {
            data = {};
        }
        data.timestamp = new Date().getTime(); //await this.getTimestamp();
        //data.recvWindow = 5000;

        return data;
    }

    private generateSignature(data: any) {
        let query = this.coreSvc.objToQueryString(data);
        let signature = crypto.createHmac('sha256', this.apiSecret)
                              .update(query)
                              .digest('hex');

        return signature;
    }
}

export default BinanceService;