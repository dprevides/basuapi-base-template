import path from 'path';
import fs from 'fs';
import {ApplicationRouter} from '@basuapi/api'
import {ApplicationRouterParams} from '@basuapi/api/dist/application-router'
import { ApplicationDeployAdapterClassHolder } from '@basuapi/api/dist/application-deploy-adapter-class-holder';
import { packageInfoJson } from "./configs/package-info.json";
import { swcJson } from "./configs/swcrc";
import copy from 'recursive-copy';
import nunjucks from 'nunjucks'
import { execSync } from 'child_process';
import { BaseConfig } from '../adapter';

export class CustomAppRoute extends ApplicationRouter{

    constructor(routes:any){
        super(null as any,routes)
    }

    protected setRoute(method:string,params:ApplicationRouterParams, value:any|Array<any>){
        this.methods.push(params)
    }

    getInfo(): ApplicationRouterParams[]{        
        return this.methods;
    }
}

export class BaseAdapter<T extends BaseConfig>{
    protected absoluteRouteFile:string;
    protected routeFile:string;
    protected routeMethod:string;
    protected route:string;
    protected destination:string;
    protected mergeDependencies:boolean;
    protected language:string;
    protected applicationFolder:string;
    protected name:string;
    protected replaceFilesInDestination:boolean;
    constructor(
        protected config:T
    ){
        this.route = config.route;
        this.destination = config.folder;
        this.mergeDependencies = config.mergeDependencies;
        this.language = config.language;
        this.applicationFolder = config.applicationFolder;
        this.name = config.name;
        this.replaceFilesInDestination = config.replaceFiles

        const [routeFile,routeMethod] = this.route.replace('./','').split('.');
        this.routeFile = routeFile;
        this.routeMethod = routeMethod;
        this.absoluteRouteFile = path.join(process.cwd(),routeFile);
    }

    protected runCommand(command:string){
        try {
            execSync(command, {stdio: 'inherit'})
        }catch(e){
            console.error('Failed to execute', e);
            return false;
        }

        return true;
    }


    protected async tryAndGetResult(logMessage:string, command:any, logError?:string){
        try {
            console.log(logMessage);
            return command();
        }catch(ex){
            console.error(logError);
            console.error(ex);
        }
    }

    async init() : Promise<void>{
        const instance = await this.tryAndGetResult(`Getting instance from ${this.routeFile}.${this.routeMethod}`, () => require(this.absoluteRouteFile)[this.routeMethod]);

        const customRoutes = new CustomAppRoute(instance).getInfo();
        console.log(customRoutes.map(m => `${m.route}.${m.method}[${m.parameters}]`));

        await this.createDestination(this.destination);
        const routes = await this.getRoutesInformation(customRoutes) as ApplicationDeployAdapterClassHolder[];
        const jsonDependencies =  this.mergeDependencies ?  await this.mergeJsonDependencies() : this.getLocalJsonDependencies();
        await this.copyDistFolder();
        await this.generateConfigs(jsonDependencies);
        await this.generateFiles(routes);
        const installDeps = `cd ${this.destination} && yarn install `;
        console.log(`Installing dependencies`);
        const installDepsOut = this.runCommand(installDeps);
        if (!installDepsOut){
            console.error("Error installing dependencies");
            return process.exit(-1);
        }

    }

    /* Creates the output path folder, recursively */
    protected async createDestination(destinationPath:string){
        fs.mkdirSync(destinationPath, { recursive: true });
    }

    /**
     * Get formatted information about routes
     * @param items 
     * @returns 
     */
    protected async getRoutesInformation(items:ApplicationRouterParams[]){
        const classes:ApplicationDeployAdapterClassHolder[] = []; 
        for (let item of items){
            const name = item.route.replace(/\//g, '_');
            const applicationClassHolder = new ApplicationDeployAdapterClassHolder(name);
            let currentClass = classes.find((c:ApplicationDeployAdapterClassHolder) => c.name === name);
            if (!currentClass){
                currentClass = applicationClassHolder;
                classes.push(applicationClassHolder);
            }
            currentClass.methods.push({method: item.method, params: item.parameters, route: item.route, routeSteps: item.routeSteps})
        }

        return classes;
    }

    /** 
     * Return dependencies of local json configuration file
     */
    protected getLocalJsonDependencies(){
        return packageInfoJson.dependencies ? packageInfoJson.dependencies : [];
    }


    /**
     * Merge dependencies of local template file and project
     * @returns 
     */
    protected async mergeJsonDependencies(){
        const sourcePackageJson = path.join(process.cwd(),'package.json');
        if (fs.existsSync(sourcePackageJson)){
            const sourceContent = JSON.parse(fs.readFileSync(sourcePackageJson) as any);
            const localContent = packageInfoJson;

            const sourceDependencies = sourceContent.dependencies as any;
            const localDependencies = localContent.dependencies as any;

            let dependenciesMerged = {} as any;
            if (sourceDependencies){
                for (let dep of Object.keys(sourceDependencies)){
                    dependenciesMerged[dep] = sourceDependencies[dep];
                }
            }
            if (localDependencies){
                for (let dep of Object.keys(localDependencies)){
                    dependenciesMerged[dep] = localDependencies[dep];
                }
            }

            return dependenciesMerged;
        }
    }

    /**
     * Copy compiled folder ro output folder
     */
    protected async copyDistFolder(){
        const source = path.join(process.cwd(),this.applicationFolder);
        if (!fs.existsSync(path.join(this.destination,'app'))){
            fs.mkdirSync(path.join(this.destination,'app'));
        }
        const destination = path.join(this.destination,'app');
        copy(source,destination,{
            concurrency: true,
            overwrite: true            
        } as any)
        console.log(`Copying ${source} to ${destination}`);
    }

    /**
     * Copy the default config files to generated project
     */
    protected async generateConfigs(dependencies:any){
        const packageInfo = packageInfoJson;
        const swcConfigJson = swcJson;

        packageInfo.dependencies = dependencies;
          
        fs.writeFileSync(path.join(this.destination,'package.json'),JSON.stringify(packageInfo,null,2));
        fs.writeFileSync(path.join(this.destination,'.swcrc'),JSON.stringify(swcConfigJson,null,2));
        fs.writeFileSync(path.join(this.destination,'yarn.lock'),JSON.stringify({},null,2));
    }


    /**
     * Creates the path to a destination file
     * @param currentClass 
     * @returns 
     */
    protected async createDestinationStructure(currentClass: ApplicationDeployAdapterClassHolder): Promise<string>{
        if (!fs.existsSync(path.join(this.destination,'src'))){
            fs.mkdirSync(path.join(this.destination,'src'));            
        }

        let currentPath = path.join(this.destination,'src').toString();
        
        for (let fn of currentClass.methods){
            const routes = fn.route.split("/");
            for (let route of routes){                
                const routePath = path.join(currentPath,route);
                if (!fs.existsSync(routePath)){
                    fs.mkdirSync(routePath);
                }
                currentPath = routePath;
            }
        }


        return currentPath;
    }

    /**
     * Generate and save all files
     */
    protected async generateFiles(classes:ApplicationDeployAdapterClassHolder[]){
        for (let item of classes){
            const extension = this.language === 'typescript' ? 'ts' : 'js';
            const folderPath = await this.createDestinationStructure(item);
            const filePath = path.join(folderPath,`index.${extension}`);
            if (!this.replaceFilesInDestination && fs.existsSync(filePath)){
                console.debug("File exists, skipping - " + filePath)
                continue;
            }            

            item.imports.push(`import {${this.routeMethod}} from '@app/${this.routeFile?.replace("dist/","")}'`);

            const methods:any[] = [];
            for (let method of item.methods){
                let routePath = "";
                method.routeSteps.forEach(m => {
                    if (routePath != ""){
                        routePath += ""
                    }
                    routePath += `["${m}"]`
                });
                methods.push({routePath, method: method.method, item:method})
            }

            //compiling template
            const content = await this.getTemplate();
            const template = await this.getRenderedTemplate(content,item,this.routeMethod,methods);

            fs.writeFileSync(filePath, template);


        }
    }


    /**
     * Gets a nunjucks template string
     * @returns 
     */
    protected async getTemplate():Promise<string>{
        const templatePath =  `${__dirname}/../../../templates/${this.language.toLowerCase()}/handler.njk`;
        if (!fs.existsSync(templatePath)){
            throw new Error(`${templatePath} does not exists. Make sure you choose a valid language.`);
        }
        return fs.readFileSync(templatePath).toString();
    }


    /**
     * Get a rendered templatete according to template string
     * @param content String containing template
     */
    protected async getRenderedTemplate(content:string, item:ApplicationDeployAdapterClassHolder, routeMethod:string, methods:{routePath:string, method: string, item: ApplicationDeployAdapterClassHolder}[]){
        return nunjucks.configure({
            autoescape: false
        }).renderString(content,{item, methods, routeMethod, port: 3000});
    }


}