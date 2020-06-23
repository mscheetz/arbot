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
}

export default CoreService;