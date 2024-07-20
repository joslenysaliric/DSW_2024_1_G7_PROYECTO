const http = require("http");
http
  .createServer((req, res) => {
    //req: request es la peticion al server
    //res: responce es la respuesta del servidor
    console.log(req); // res.writeHead(201, { 'Content-Type': 'application/json'}) // recurso no encontrado
    
    res.writeHead(201,{'Content-Type':'application/json'})//recurso no encontrado
    //res.setHeader("Content-Disposition", "attachment;filename = lista.csv");
    //res.writeHead(200, { "Content-Type": "application/csv" });
    //res.write("id,nombre\n");
    //res.write("1,Fernando\n");
    //res.write("2,Mariza\n");
    //res.write("3,Gladys\n");
    res.write("hola mundo");
    res.end();
  })
  .listen(8080); //puerto por donde el servidor escuchara las peticiones
console.log("Escuchando el puerto: ", 8080);
