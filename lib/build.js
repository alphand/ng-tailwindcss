const exec = require('child_process').exec;
const fs = require('fs');
const path = require('path');
const purge = require('./purge');

// Conditionally require node-sass or dart-sass
const pathToNodeSass = path.normalize(
  path.resolve(process.cwd(), 'node_modules', 'node-sass')
);
const pathToDartSass = path.normalize(
  path.resolve(process.cwd(), 'node_modules', 'sass')
);
let sass = null;

try {
  sass = require(pathToNodeSass);
} catch (err) {
  try {
    sass = require(pathToDartSass);
  } catch (e) {
    sass = null;
  }
}

const twBuild = ({ configFile, outputFile, purge }) => sourceFile =>
  new Promise((resolve, reject) =>
    exec(
      `${path.normalize(
        './node_modules/.bin/tailwind'
      )} build "${sourceFile}" -c "${configFile}" -o "${outputFile}"`,
      err => {
        if (err) return reject(err);

        console.info('Successful Tailwind Build!');

        if (purge) purge({ outputFile });

        return resolve(sourceFile);
      }
    )
  );

const twBuildComponent = config => sourceFile =>
  new Promise((resolve, reject) => {
    const outFile = sourceFile.replace(/compiled/, 'component');
    exec(
      `${path.normalize(
        './node_modules/.bin/tailwind'
      )} build "${sourceFile}" -c "${config.baseConfigJS}" -o "${outFile}"`,
      err => {
        if (err) return reject(err);

        purge({ outputFile: outFile });
        console.info('Successful Tailwind Component Build!');

        return resolve(sourceFile);
      }
    );
  });

const sassBuild = (source, tempFileName = 'temporary-tailwind-css-file.css') =>
  new Promise((resolve, reject) =>
    sass.render(
      {
        file: source
      },
      (err, result) => {
        if (err) return reject(err);

        const tempFile = path.normalize(
          path.resolve(process.cwd(), tempFileName)
        );

        fs.writeFile(tempFile, result.css, err =>
          err
            ? reject(err)
            : console.info('Sass Compiled.') || resolve(tempFile)
        );
      }
    )
  );

const removeFile = file => {
  console.log('removing file:', file);
  fs.unlink(file, err => err && console.error(err));
};

module.exports = ({ purgeFlag, componentPath }) => {
  const ngTwFile = path.normalize(
    path.resolve(process.cwd(), 'ng-tailwind.js')
  );
  const config = fs.existsSync(ngTwFile) && require(ngTwFile);

  if (config) {
    if (config.sass) {
      if (!sass) {
        console.log(
          'No sass compiler installed. Run `npm i -O node-sass` or `npm i -O sass` and try again.'
        );
        return;
      }

      if (componentPath) {
        const componentName = componentPath.substring(
          componentPath.lastIndexOf(path.sep) + 1,
          componentPath.indexOf('.')
        );

        const sassPath = componentPath.substring(
          0,
          componentPath.lastIndexOf(path.sep) + 1
        );

        sassBuild(componentPath, `${sassPath}${componentName}.compiled.css`)
          .then(twBuildComponent(config))
          .then(removeFile)
          .catch(err => err && console.error(err));
        return;
      }

      Object.keys(config.configJS).map(key => {
        const configFile = config.configJS[key];
        const configPath = configFile.substring(0, configFile.lastIndexOf('/'));
        console.log('my path', configFile, path.sep, configPath);
        sassBuild(config.tailwindBase, `${configPath}/twbase-${key}.temp.css`)
          .then(
            twBuild({
              configFile: config.configJS[key],
              outputFile: `${config.outdir}/${key}.tw.css`,
              purge: purgeFlag
            })
          )
          .then(removeFile)
          .catch(err => err && console.error(err));
      });
    } else {
      twBuild(config.sourceCSS).catch(err => err && console.error(err));
    }
  } else {
    console.error(`No ng-tailwind.js file found at ${ngTwFile}.
Please run \`ngtw configure\` in your project's root directory.
Run \`ngtw --help\` for assistance,
or view the Readme at https://github.com/tehpsalmist/ng-tailwindcss`);
  }
};
