import express from 'express';
import * as bodyParser from 'body-parser';
import * as dotenv from 'dotenv';
import ArbitrageService from './services/arbitrage.service';
 
class App {
  public app: express.Application;
  public port: number;
 
  constructor(controllers: any[], port: number) {
    this.app = express();
    this.port = port;
 
    this.initializeMiddlewares();
    this.initializeControllers(controllers);
    
  }
 
  private initializeMiddlewares() {
    dotenv.config();
    this.app.use(bodyParser.json());
  }
 
  private initializeControllers(controllers: any[]) {
    if(controllers.length === 0) {
      return;
    }
    controllers.forEach((controller) => {
      this.app.use('/', controller.router);
    });
  }
 
  public listen() {
    this.app.listen(this.port, () => {
      console.log(`App listening on port ${this.port}`);
    });
  }

  public startBot(){
    const svc = new ArbitrageService();
    svc.startBot();
  }
}
 
export default App;