const chokidar = require('chokidar');
const build = require('./build');
const fs = require('fs');
const path = require('path');

module.exports = () => {
  const ngTwFile = path.normalize(
    path.resolve(process.cwd(), 'ng-tailwind.js')
  );

  if (fs.existsSync(ngTwFile)) {
    const config = require(ngTwFile);

    const configWatch = Object.keys(config.configJS).map(
      key => config.configJS[key]
    );

    const tailwind = chokidar.watch([...configWatch, config.tailwindBase], {
      usePolling: true
    });

    tailwind.on('change', (event, path) => {
      console.log('Reprocessing changes to Tailwind files');

      build({});
    });

    const twComponents = chokidar.watch([...config.componentStyles], {
      usePolling: true
    });

    twComponents.on('change', (path, event) => {
      console.log('Reprocessing changes to Tailwind Component Files');
      build({ purgeFlag: true, componentPath: path });
    });

    const hotReload = chokidar.watch([ngTwFile]);

    hotReload.on('change', (event, path) => {
      delete require.cache[ngTwFile];

      console.log('Processing changes to ng-tailwind.js');

      build({});
    });

    printWatchedFiles(
      ...configWatch,
      config.tailwindBase,
      ...config.componentStyles,
      ngTwFile
    );
  } else {
    console.error(`No ng-tailwind.js file found at ${ngTwFile}.
Please run \`ng-tailwindcss configure\` in your project's root directory.
Run \`ng-tailwindcss --help\` for assistance,
or view the Readme at https://github.com/tehpsalmist/ng-tailwindcss`);
  }
};

function printWatchedFiles(...files) {
  console.log(`Watching tailwind files for changes:
  ${files.map(f => path.basename(f)).join('\n  ')}`);
}
