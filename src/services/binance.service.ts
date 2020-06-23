import * as crypto from 'crypto';
import CoreService from './core.service';
import axios from 'axios';
import { TradeSide } from '../classes/enums';

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

    public getPairs = async() => {
        const endpoint = '/v3/exchangeInfo';
        const data = await this.onGet(endpoint);
        const tickers = await this.getPrices();
        let pairs: any[] = [];

        data.symbols.forEach((symbol: any) => {
            if(symbol.status === "TRADING") {
                const price = tickers[symbol.symbol];
                pairs.push([symbol.symbol, symbol.baseAsset, symbol.quoteAsset, price]);
            }
        });

        return pairs;
    }

    public getPrices = async() => {
        const endpoint = '/v3/ticker/price';
        const data = await this.onGet(endpoint);

        return data;
    }

    public getDepth = async(pair: string, limit: number = 5) => {
        const endpoint = '/v3/depth';
        const body = {
            symbol: pair,
            limit: limit
        };
        const data = await this.onGet(endpoint, body, false);

        return data;
    }

    public placeMarketOrder = async(pair: string, side: TradeSide, quantity: number) => {
        const endpoint = 'v3/order';
        let body: any = {
            symbol: pair,
            side: side
        };
        if(side === TradeSide.BUY) {
            body.quoteOrderQuantity = quantity;
        } else {
            body.quantity = quantity;
        }

        const result = await this.onPost(endpoint, body, true);

        return result;
    }

    public placeLimitOrder = async(pair: string, quantity: number, price: number) => {
        return true;
    }

    public checkBalance = async(pair: string = "") => {
        const endpoint = '/v3/account';

        const data = await this.onGet(endpoint, null, true);
        const balances = data.balances;

        if(pair !== "") {
            return balances.filter((b: any) => b.asset === pair);
        }
        
        return balances;
    }

    private onGet = async(endpoint: string, data: any = null, secure: boolean = false) => {
        if(secure) {
            data = this.modifyBody(data);
        }
        let url = `${this.urlBase}/${endpoint}`;
        if(data !== null) {
            const queryString = this.coreSvc.objToQueryString(data);
            url += `?${queryString}`;
        }
        if(secure) {
            const signature = this.signRequest(data);
            url += `&signature=${signature}`;
        }

        try{
            const response = await axios.get(url);

            return response.data;
        } catch(err){
            console.log(err);
            return null;
        }
    } 

    private onPost = async(endpoint: string, body: any, secure: boolean = false) => {
        let url = `${this.urlBase}/${endpoint}`;
        if(secure) {
            body = this.modifyBody(body);
            const signature = this.signRequest(body);
            url += `?signature=${signature}`;
        }

        try{
            const response = await axios.post(url, body);

            return response.data;
        } catch(err){
            console.log(err);
            return null;
        }
    } 

    private modifyBody(data: any) {
        if(data === null) {
            data = {};
        }
        data.timestamp = new Date().getTime();
        data.recvWindow = 5000;

        return data;
    }

    private signRequest(data: any) {
        let query = this.coreSvc.objToQueryString(data);
        let signature = crypto.createHmac('sha256', this.apiSecret)
                              .update(query)
                              .digest('hex');


    }
}

export default BinanceService;