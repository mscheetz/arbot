import { v4 as uuid } from 'uuid';

class CoreService {
    constructor() {}

    public objToQueryString(obj: any): string {
        let qs = "";

        Object.keys(obj).forEach(o => {
            if(qs !== "") {
                qs += "&";
            }
            qs += `${o}=${obj[o]}`;
        });

        return qs;
    }

    public getSubArray(array: any[], prop: string, value: any) {
        let filtered = [];
        let found = false;
        for(const arr of array) {
            for(const key in arr) {
                if(typeof(arr[key] === "object")){
                    const item = arr[key];
                    if(item[prop] === value) {
                        found = true;
                    }
                    break;
                }
            }
            if(found) {
                filtered = arr;
                break;
            }
        }
    
        return filtered;
    }

    public decimalCleanup = function(value: string) {
        if(typeof value === 'undefined' || value === "") {
            return "";
        }
        let cleaned = "";
        let valueArray = value.split("");
    
        for(let i = valueArray.length - 1; i >= 0; i--) {
            if(valueArray[i] !== "0") {
                let newArray = valueArray.slice(0, i + 1);
                cleaned = newArray.join("");
                break;
            }
        }
        if(cleaned.slice(-1) === ".") {
            cleaned = cleaned + "00";
        }
    
        return cleaned;
    }

    public percentDiff = function(base: number, compare: number) {
        const percent = 1 - (base / compare);
        return percent;
    }

    public validPercent = function(actual: number, compare: number) {
        const comparePercent = compare > 0 
                                ? compare / 100
                                : compare; 
        
        return actual >= comparePercent;
    }

    public validateTrade(startingAmount: number, value: number, triggerPercent: number) {
        const diffPercent = this.percentDiff(startingAmount, value);
        const validTrade = this.validPercent(diffPercent, triggerPercent);

        return validTrade;
    }

    public getUuid = function() {
        const uuid4 = uuid();

        return uuid4.toString();
    }

    public roundDown(value: number, decimals: number) {
        return (Math.floor(value * Math.pow(10, decimals)) / Math.pow(10, decimals));
    }

    public getDecimals(value: number) {
        let decimals = 0;
        if(value < 1) {
            let valueArray = value.toString().split("");            
            let decimalFound = false;

            for(let i = 0; i < valueArray.length; i++) {
                if(!decimalFound && valueArray[i] === ".") {
                    decimalFound = true;
                } else if(decimalFound) {
                    decimals++;
                    if(valueArray[i] === "1") {
                        break;
                    }
                }
            }
        } 

        return decimals;
    }

    public sleep(seconds: number) {
        console.log(`Pausing for ${seconds} seconds`);
        const ms = seconds * 1000;
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
}

export default CoreService;