import * as crypto from 'crypto';
import CoreService from './core.service';
import axios from 'axios';
import { TradeSide } from '../classes/enums';
import { PriceItem } from '../classes/price-item.class';
import { Depth } from '../classes/depth.class';

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
        let pairs: PriceItem[] = [];

        data.symbols.forEach((symbol: any) => {
            if(symbol.status === "TRADING") {
                const price = tickers[symbol.symbol];
                let item = new PriceItem(symbol.symbol, symbol.baseAsset, symbol.quoteAsset, price);
                pairs.push(item);
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

        const depth: Depth = {
            pair: pair,
            bid: data.bids[0][0],
            ask: data.asks[0][0]
        };

        return depth;
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
        const data = {
            symbol: pair,
            quantity: quantity,
            price: price
        }

        console.log(`${data}`);

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
        let config = {
            headers: {
                'X-MBX-APIKEY': this.apiKey
            }
        };
        if(secure) {
            const signature = this.generateSignature(data);
            url += `&signature=${signature}`;
        }
        

        try{
            const response = secure 
                                ? await axios.get(url, config)
                                : await axios.get(url);

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
            const signature = this.generateSignature(body);
            url += `?signature=${signature}`;
        }
        let config = {
            headers: {
                'X-MBX-APIKEY': this.apiKey
            }
        };

        try{
            const response = secure
                                ? await axios.post(url, body, config)
                                : await axios.post(url, body);

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

    private generateSignature(data: any) {
        let query = this.coreSvc.objToQueryString(data);
        let signature = crypto.createHmac('sha256', this.apiSecret)
                              .update(query)
                              .digest('hex');

        return signature;
    }
}

export default BinanceService;