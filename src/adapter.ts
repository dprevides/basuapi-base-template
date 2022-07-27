import { Command, program } from 'commander';
import path from 'path';
import fs from 'fs';

export class BaseConfig {
  route!:string
  folder!:string
  mergeDependencies!:boolean
  language!:string
  applicationFolder!:string
  name!:string
  replaceFiles!:boolean
}
export abstract class BaseAdapterClient<T extends BaseConfig> {
  commander: Command = program;

  constructor(
    protected name:string,
    protected description:string,
    protected version:string,
    protected packageName:string,
    protected projectPath = process.cwd(),
    protected configName = '.basuapi',
  ){}

  public async execute(){
    this.commander
    .name(this.name)
    .description(this.description)
    .version(this.version);

    await this.setCommandInstall(this.commander);
    await this.setCommandGenerate(this.commander);

    program.parse();
  }

  protected getPackageInfo(){
    return JSON.parse(fs.readFileSync(path.join(this.projectPath,"package.json")).toString());
  }

  protected getConfig() : T{
    return JSON.parse(fs.readFileSync(path.join(this.projectPath,this.configName)).toString());
  }

  protected getSection(item:any, sectionName:string){
    let section = item[sectionName];
    if (!section){
        section = {};
    }
    return section;
  }

  protected addToSection(section:any, key:string, value:string){
    if (!section){
        section = {};
    }
    section[key] = value;
  }

  protected getMessages(){
    return {
      folderArgumentDescription:`The folder where it will be generated. Defaults to ${this.projectPath}/adapters/${this.name}`,
      routeArgumentDescription:`The path wich will be called to retrieve the routes. This path must be compose by a file path and a method. Eg:  dist/main.routes (dist/main is the file and routes is an exported function inside the file),`,
      mergedepsArgumentDescription:`If true, the generated packages will use the same dependencies as the project. Default is true.`,
      languageArgumentDescription:`Language the template will be generated. Default is typescript. (typescript|javascript)`,
      applicationFolderArgumentDescription:`Application folder containing the code. Default is dist`,
      replaceFilesArgumentDescription: `If true the destination files will be replaced.Default is false`
    }
  }

  protected async setCommandInstall(program:Command){
    program.command('install')
    .description('Installs the adapter')
    .argument('<route>', this.getMessages().routeArgumentDescription)  
    .option('--folder <folder>', this.getMessages().folderArgumentDescription,`${path.join('adapters',this.name)}`)
    .option('--mergedeps <mergedeps>', this.getMessages().mergedepsArgumentDescription, true)
    .option('--language <language>', this.getMessages().languageArgumentDescription, 'typescript')
    .option('--applicationfolder <applicationfolder>', this.getMessages().applicationFolderArgumentDescription, 'dist')
  
    .action((route, options) => {
      return this.getActionCommandInstall(route,options);
    });
  }

  protected getActionCommandInstall(route:string, options:{folder:string, mergedeps:string, language:string, applicationfolder:string}){
    let config = {};
    const packageInfo = this.getPackageInfo();
    this.addToSection(packageInfo.scripts,`adapter:${this.name}:build`,`yarn build && cd ${options.folder} && yarn build`);
    this.addToSection(packageInfo.scripts,`adapter:${this.name}:generate`,`yarn build && npx @${this.packageName} generate`);
    this.addToSection(packageInfo.scripts,`adapter:${this.name}:start`,`cd ${options.folder} && yarn build && node api/index.js`);
    this.addToSection(packageInfo.scripts,`adapter:${this.name}:start:debug`,`cd ${options.folder} && yarn build && node --inspect-brk api/index.js`);

    fs.writeFileSync(path.join(this.projectPath,"package.json"), JSON.stringify(packageInfo,null,2));

    //Creating the config file
    const configPath = `${process.cwd()}/${this.configName}`;
    if (fs.existsSync(configPath)){
      config = this.getConfig();
    }

    this.addToSection(config,'folder', options.folder);
    this.addToSection(config,'route', route);
    this.addToSection(config,'mergeDependencies', options.mergedeps);
    this.addToSection(config,'language', options.language);
    this.addToSection(config,'applicationFolder', options.applicationfolder);
    

    fs.writeFileSync(configPath,JSON.stringify(config,null,2));

    console.log(`${this.packageName} installed successfully`);
  }


  protected async setCommandGenerate(program:Command){
    program.command('generate')
      .description('Generate/Regenerate the plugin')
      .option('--route <route>', this.getMessages().routeArgumentDescription)  
      .option('--folder <folder>', this.getMessages().folderArgumentDescription)
      .option('--mergedeps <mergedeps>', this.getMessages().mergedepsArgumentDescription)
      .option('--language <language>', this.getMessages().languageArgumentDescription)
      .option('--applicationfolder <applicationfolder>', this.getMessages().applicationFolderArgumentDescription)
      .option('--replace-files <replacefiles>', this.getMessages().replaceFilesArgumentDescription)
      .action(async (options) => {
        return await this.getActionCommandGenerate(options);
      });
  }

  protected async getActionCommandGenerate(options:{route:string, folder:string, mergedeps:string, language:string, applicationfolder:string, replacefiles:string}){
    //Loading params from config
    const config = this.getConfig();
    if (!config && options.route){
      throw new Error(`Both ${options.route} and the config file ${this.configName} are missing. Make sure the config file exists with parameter route or pass it as an argument.`)
    }

    if (config && (!config.route && !options.route)){
      throw new Error(`The parameter route is missing on config file ${this.configName}. You can also pass it as a parameter`);
    }

    let optionsRoute = config.route;
    let optionsFolder = config.folder;
    let mergeDependencies:boolean = config.mergeDependencies != null ? config.mergeDependencies : true;
    let language:string = config.language != null ? config.language : "typescript";
    let applicationFolder = config.applicationFolder ? config.applicationFolder : 'dist'
    let replaceFiles = false;

    if (options.route){
      optionsRoute = options.route
    }

    if (options.folder){
      optionsFolder = options.folder
    }

    if (options.mergedeps){
      mergeDependencies = options.mergedeps.toString().toLowerCase() == "true" ? true : false
    }

    if (options.language){
      language = options.language
    }

    if (options.applicationfolder){
      applicationFolder = options.applicationfolder
    }

    if (options.replacefiles){
      replaceFiles = options.replacefiles.toLowerCase() === "true" ? true : false;
    }

    const customConfig = {
      ...this.getConfig(),
      route: optionsRoute,
      folder: optionsFolder,
      mergeDependencies: mergeDependencies,
      language: language,
      applicationFolder: applicationFolder,
      replaceFiles: replaceFiles
    } as T;

    await this.startAdapter(customConfig);

  }


  protected abstract startAdapter(config:T) : Promise<void>;//{
    // const baseAdapter = new BaseAdapter(config);
    // baseAdapter.init();
  //}

}