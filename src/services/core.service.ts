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

        return "";
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
        return 1 - (compare - base);
    }

    public validPercent = function(actual: number, compare: number) {
        const comparePercent = compare > 0 
                                ? compare / 100
                                : compare; 
        
        return actual >= comparePercent;
    }

    public getUuid = function() {
        const uuid4 = uuid();

        return uuid4.toString();
    }
}

export default CoreService;