import express from 'express';
import * as bodyParser from 'body-parser';
import * as dotenv from 'dotenv';
 
class App {
  public app: express.Application;
  public port: number;
 
  constructor(controllers: any[], services: any[], port: number) {
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
    controllers.forEach((controller) => {
      this.app.use('/', controller.router);
    });
  }
 
  public listen() {
    this.app.listen(this.port, () => {
      console.log(`App listening on the port ${this.port}`);
    });
  }
}
 
export default App;