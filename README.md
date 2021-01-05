![Elements](https://github.com/elementscode/application/blob/master/assets/dark.png?raw=true)
<br/>
<h3>The app framework for TypeScript.</h3>

## Introduction
Elements lets you build full stack, scalable web apps in TypeScript, with an
insanely productive developer experience. It's the modern Ruby on Rails for
TypeScript and CSS, combining an application framework with fast build tooling.
Create a modern app without compromising between the server and browser.

Elements is built for TypeScript apps. But you can start with JavaScript and
adopt TypeScript incrementally. The Elements tooling makes it all just work,
even if you start with JavaScript and move to TypeScript later.

The app framework lets you write your React pages like you always have. Define
routes in code using a simple api, telling Elements which component to render
and passing initial data. Get server data by simply importing and calling
functions. Automatically get server and browser routing and rendering, asset
urls transformed to cdn urls, data fetching that works the same way on the
initial render and in the browser. Create http api routes just as easily as
creating pages. Use Postgres out of the box and work with strongly typed rows of
data instead of with models.

Elements build is zero config and just works out of the box for the server and
browser. It compiles TypeScript, React and CSS, links browser assets and creates
runtime files like dist.json, bundle.js, and loader.js that the app framework
takes advantage of. Builds and rebuilds are extremely fast. Bundles are
automatically split by page which means you don't have to worry about download
scale issues as your code base grows and the user has to download more and more
JavaScript.

The first versions of Elements were created at a fintech healthcare startup. We
grew from a small prototype with two engineers to a hipaa compliant bank with
twenty engineers, 200k lines of code, and over a $100M dollars of transactions
processed through the system. We needed tooling and a framework that could
handle a large code base and a fast user experience. A single page app wasn't
going to cut it. And we needed cold and hot build times to be milliseconds, not
10 minutes.

## Install
1. Install Node.js: <a href="https://nodejs.org/en/">https://nodejs.org/en/</a>
2. Install Elements: <a href="https://elements.dev/install">https://elements.dev/install</a>

Just the app framework:
```bash
> elements install @elements/application:next
```

*Note: You can also use npm or yarn to install packages. But you must have the elements program installed to install the app packages.*

## Learn
Watch: <a href="https://elements.dev/learn/the-quick-tour-c9b9">The 1-Minute Tour</a>.

Learn more: <a href="https://elements.dev">https://elements.dev</a>.

## People
Come hang out with other Elements people <a href="https://people.elements.dev">here</a>.

Or send me an email and say hello: <a href="mailto:chris@elements.dev?subject=@elements/application">chris@elements.dev</a>

## Quick Start
```bash
> elements create app demo && cd demo
> elements install
> elements start
```

Try this:
  1. open http://localhost:4000
  2. update some html text in *app/pages/home/index.tsx* and save the file to see the hot reload
  3. add `color: green` to the css rule in *app/pages/home/index.css* and save the file to see the hot reload
  4. look at *app/index.ts* to see the main app file
  5. look at *app/routes/main/index.ts* to see the page routes
  6. look at *app/routes/api/v1/index.ts* to see api routes
  7. look at *app/services/index.ts* to see the service functions


## Troubleshoot File Descriptor Limits
The most common initial problem is that your file descriptor limit is too low. If you get an error that looks like this when you start the app, you need to increase your file descriptor limit so the file watcher can watch your project for file changes.

- Mac: `sudo launchctl limit maxfiles 100000 200000`
- Linux: `sudo sysctl -w fs.file-max=100000 && sudo sysctl -p` (edit /etc/sysctl.conf to make permanent across reboots)

## Features
### Install
Elements comes with its own fast package installer for Node.js. Use `elements
install` to install all packages in the project. Or install a specific package
and version. If you prefer, you can also use npm or yarn.

```bash
> elements install
> elements install @elements/application:1.0.0
```

### Start
The start command builds and starts your project, rebuilding and hot reloading it when project files
change. It's ridiculously fast. The app server receives a USR2 signal after a
build so that it can reload itself in memory, and send a reload signal to all
connected browser clients. The server uses the dist.json file produced by the
build tool to determine which files have changed, in linear time, and hot swaps
those files from the module cache. All of this happens before your eyes even
notice.

```bash
> elements start
```

### Build
You an use the build command independently on any JavaScript or TypeScript
project. It's also useful when you're working on a package. You can write the
build as a gzipped tarball to stdout. And you can build in watch mode to rebuild
when project files change.

```bash
> elements build
> elements build -tgz > dist.tgz
> elements build -watch
```

### Routing
The router works seemlessly on the server and in the browser. Server side
rendering, with data, just works out of the box. Once the app is loaded in the
browser, new page resources are hot patched into the head section to render a
new route's page. Combined with http caching, this creates an incredibly fast
user experience.

```typescript
router.page('/products/:id', async function(this: IRequest) {
  // Call service functions for data using url parameters.
  let product = await getProduct(this.params.get('id'));
  
  // Set a title, description and metadata.
  this.title(product.name);
  this.description(product.description);
  this.meta({ name: 'description', content: product.description });
  
  // Render a react component with initial data for SEO and fast initial render.
  this.render('app/pages/product', {
    product: product
  });
});
```

```typescript
router.page('/products/:id', async function(this: IRequest) {
  // Use the Node.js req and res objects directly.
  this.req.write('hello world\n');
  this.req.end();
});
```

### CSS
CSS is first class in Elements apps. You can declare a dependency to
CSS in a React page or component using a triple-slash comment. CSS files needed
for the page, across the forest of components, are automatically linked together
in a topologically sorted order, for each page in the app.

```typescript
/// <style path="./index.css" />

export default (props) => {
  return (
    <div className="home-page"></div>
  );
}
```


### API Routing
Creating server only api routes is just as easy as creating pages.

```typescript
// Import routes at specific prefixes for versioned apis.
app.routes('/api/v1', require('app/routes/api/v1'));
```
```typescript
// Create http verb routes and use the json method to send back json.
router.route('get', '/products/:id', async function(this: IRequest) {
  let product = await getProduct(this.params.get('id'));
  
  // set the http status code.
  this.status(200);
  
  // set http headers.
  this.header('X-PoweredBy', 'elements');
  
  // serialize object to json and send to the client.
  this.json(product);
});
```

### Email
Emails are just React components. You can even use the same css styling as from
pages. Render a React component as an email and send it using the Email class.

```typescript
import { Email } from '@elements/application';

Email.create()
  .subject('Welcome')
  .from('hello@elements.dev')
  .to('chris@elements.dev')
  .render('app/emails/welcome', { name: 'Chris' })
  .send();
```

### Forms
Get form data with `await getFormData(formEl)`. It will automatically collect
all the form's fields into a JavaScript object. It even reads files so you can
upload files like any other form field. Pass the resulting object to a service
function as a parameter to save data on the server.

```typescript
import { getFormData } from '@elements/application';
import * as services from 'app/services';

export default Form extends React.Component {
  onSubmitForm(e) {
    e.preventDefault();

    // Get the form inputs as an object. Handles
    // file inputs too.
    let data = await getFormData(e.target);

    // Pass the form data to a service function.
    await services.updateData(data);
  }
}
```

### Service Functions
Service functions are just async functions exported from any file in the
*app/services* directory. You can import and call these functions from routes
and from React components. The build tool automatically converts these function
calls into rpc calls over the wire. If you prefer, you can still use http apis
but service functions let your app team work really fast without having to worry
about rest url schemas.

```typescript
// Any async function exported from a module in the app/services
// directory can be called over the wire like an rpc function.
export async function getProduct(id: string): Promise<IProduct> {
  return {
    id: '1',
    name: 'Great Product',
    description: 'It so good.'
  };
}
```
```typescript
import { Router } from '@elements/application';

// Import service functions like any other module.
import * as services from 'app/services';

let router = new Router();
export default router;

router.page('/products/:id', async function(this: IRequest) {
  // Then call the service function like any other function,
  // from a route or a React component.
  let product = await services.getProduct(this.params.get('id'));
  this.render('app/pages/product', { product });
});
```

### JSON Serialization
The *@elements/json* package in elements provides an extended json syntax
allowing for advanced serialization across the wire. You can serialize any class
by simply decorating the class with the `@json` decorator and importing the
module in the page or route where it's used. Instead of getting a plain object
off the wire, you'll get the fully featured class.

```typescript
import { json } from '@elements/application';

@json
export class User {
}
```

### Session and Authentication
Sessions in Elements work on the server and in the browser, over http and over
WebSockets. You can login the user inside a service function by calling the
`login(userId: string)` methed of the session. You can check if a user is logged
in by calling the `isLoggedIn()` method of session.

```typescript
export async function login(user: string, password: string): Promise<void> {
  // Create an authenticated session (i.e. log the user in).
  this.session.login('userId');
}
```
```typescript
export async function logout(): Promise<void> {
  // Log the user out.
  this.session.logout();
}
```

```typescript
router.page('/products/new', async function(this: IRequest) {
  // Check for authenticated session in a route.
  if (!this.session.isLoggedIn()) {
    this.go('/login');
  }
  
  this.render('app/pages/products/new');
});
```

```typescript
export async function createProduct(product: IProduct): Promise<IProduct> {
  // Check for authenticated session in a service function.
  if (!this.session.isLoggedIn()) {
    throw new NotAuthorizedError();
  }
}
```

### Error Handling
Errors can be thrown over the wire in Elements, making it easy to handle errors
for both data and routes. Attach event listeners to the global error events to
handle how the app responds to common errors like data or pages not found, not
authorized, and unhandled errors. It works for pages as well as for data.

```typescript
// Whenever a NotAuthorizedError is thrown from a service function or a route,
// this event handler is called.
app.on('notAuthorizedError', async function(this: IRequest, error: NotAuthorizedError) {
  this.render('app/pages/login?redirect=' + this.url);
});
```

```typescript
// Whenever a url or data is not found this event handler will be called.
app.on('notFoundError', async function(this: IRequest, error: NotFoundError) {
  this.render('app/pages/not-found-error', { error });
});
```

```typescript
// Whenever there's an unhandled error from a route or service function,
// this event handler will be called.
app.on('unhandledError', async function(this: IRequest, error: any) {
  this.render('app/pages/unhandled-error', { error });
});
```

```typescript
import {
  Router,
  NotAuthorizedError,
  NotAcceptableError,
  NotFoundError
} from '@elements/application';

let router = new Router();
export default router;

router.page('/products/new', async function(this: IRequest) {
  if (!this.session.isLoggedIn()) {
    // NotAuthorizedError causes the global notAuthorizedError
    // event handler to be called. You can throw this from a
    // service function too.
    throw new NotAuthorizedError();
  }
});
```

```typescript
import {
  Router,
  NotAuthorizedError,
  NotAcceptableError,
  NotFoundError
} from '@elements/application';

let router = new Router();
export default router;

router.route('post', '/products/:id', async function(this: IRequest) {
  if (!this.get('post.name')) {
    // Any "safe" error will travel from the server to the browser
    // so React components can respond to the error simply by
    // catching it. Unsafe errors are seen in the browser as
    // "Unhandled Errors".
    throw new NotAcceptableError();
  }
});
```

```typescript
export async function getProduct(id: string): Promise<IProduct> {
  // Throw errors from service functions too. Safe errors will travel
  // to the browser and can be caught by the calling code. Special
  // app errors like the NotFoundError and NotAuthorizedError causes
  // the global event handlers to be called.
  throw new NotFoundError(`Product with id ${id} wasn not found!`);
}
```

```typescript
export async function getProduct(id: string): Promise<IProduct> {
  // The NotFoundError works with sql queries too.
  let result = await sql('select id, name from products where id=$1 limit 1', [id]);
  return result.firstOrThrowNotFoundError();
}
```

### Strongly Typed Postgres
You can use whatever database you'd like, but out of the box Postgres works
great with Elements. Rather than use models, you can simply write
sql and work with strongly typed result rows. Sql is only available from the
server, but you can send the `SqlResult` rows down the wire.

```typescript
import { sql } from '@elements/application';

export async getProduct(id: string): Promise<IProduct> {
  // Write regular sql and get back strongly typed rows of data.
  let result: SqlResult<IProduct> = sql<IProduct>('select id, name, price from products where id=$1', [id]);
  
  // Map over rows.
  result.map(row => ({ id: id, name: name, price: formatPrice(row.price) }));
  
  // Other SqlResult methods
  result.forEach(row => console.log(row));
  result.first();
  result.last();
  result.filter(row => row.isPublished == true);
  result.sum(row => row.price);
  result.group(row => row.date);
  result.firstOrThrowNotAuthorizedError('some msg');
  result.firstOrThrowNotFounderror('some msg');
  result.firstOrThrowError(someErrorClass, 'some msg');
}
```

### Postgres Migrations
Keep your database up to date by writing migrations to create new tables,
update existing tables, and to generally update the database.

```bash
> elements create migration
> elements migrate status
> elements migrate up
> elements migrate down
```

```typescript
import { Migration, DbConnection } from '@elements/application';

export default Migration.create({
  description: 'Create the users table',

  async up(db: DbConnection) {
     await db.sql(`
        create table users (
          id uuid primary key default uuid_generate_v1mc(),
          name text,
          created_at timestamp default current_timestamp,
          updated_at timestamp default current_timestamp
        );
     `);
  },

  async down(db: DbConnection) {
    await db.sql(`drop table users`);
  }
});
```
