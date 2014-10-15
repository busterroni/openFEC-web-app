openfec-web-app
===============

### Installing
This application is a [Node.js](http://nodejs.org/)/[Express](http://expressjs.com/) app. Dependencies are installed via [npm](https://www.npmjs.org/). Make sure to have npm installed.

Install application dependencies:
```
$ npm install
```

If you plan to do CSS development, you will want to install [Sass](http://sass-lang.com/). 

### Development
Compile Sass:
```
$ sass --watch static/styles/sass/styles.scss:static/styles/styles.css
```

### Run server
```
$ nodejs app.js
```

It will serve the site on http://0.0.0.0:8000
