import { program } from 'commander';
import packageJson from '../../package.json';
import { execSync } from 'child_process';
const packageRunnerName = 'yarn';
const runCommand = command => {
    try {
        execSync(command, {stdio: 'inherit'})
    }catch(e){
        console.error('Failed to execute', e);
        return false;
    }

    return true;
}

const gitCheckoutCommand = 'git checkout '


program
    .name("Basuapi template installer")
    .description("Installs basuapi template adaptor basic project")
    .version(packageJson.version);

program.command('install')
    .description('Install the template')
    .argument('<projectname>', "A name for the project")    
    .action((projectName) => {
        const gitCheckoutCommand = `git clone -b main --depth 1 https://github.com/dprevides/basuapi-template.git ${projectName}`;
        const installDepsCommand = `cd ${projectName} && ${packageRunnerName} install`;
        
        console.log(`Clonning the repository`);
        const checkedOut = runCommand(gitCheckoutCommand);
        if (!checkedOut) process.exit(-1);
        
        console.log(`Installing dependencies for ${projectName}`);
        const installedDeps = runCommand(installDepsCommand);
        if (!installedDeps) process.exit(-1);

        console.log(`Everything is ready for ${projectName}`);

    });


program.parse();