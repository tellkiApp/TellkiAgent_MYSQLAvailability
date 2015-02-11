
var statusId = "123:Status:9";
var responseTimeId = "26:Response Time:4";
var testQuery = "SELECT CURDATE();";

//####################### EXCEPTIONS ################################

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = "Wrong number of parameters.";
	this.code = 3;
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;

function InvalidMetricStateError() {
    this.name = "InvalidMetricStateError";
    this.message = "Invalid number of metrics.";
	this.code = 9;
}
InvalidMetricStateError.prototype = Object.create(Error.prototype);
InvalidMetricStateError.prototype.constructor = InvalidMetricStateError;

function InvalidAuthenticationError() {
    this.name = "InvalidAuthenticationError";
    this.message = "Invalid authentication.";
	this.code = 2;
}
InvalidAuthenticationError.prototype = Object.create(Error.prototype);
InvalidAuthenticationError.prototype.constructor = InvalidAuthenticationError;

// ############# INPUT ###################################

(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		if(err instanceof InvalidParametersNumberError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof InvalidMetricStateError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof InvalidAuthenticationError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else
		{
			console.log(err.message);
			process.exit(1);
		}
	}
}).call(this)



function monitorInput(args)
{
	
	if(args.length == 5)
	{
		monitorInputProcess(args);
	}
	else
	{
		throw new InvalidParametersNumberError()
	}
	
	
	
}


function monitorInputProcess(args)
{
	//host
	var hostname = args[0];
	
	//metric state
	var metricState = args[1].replace("\"", "");
	
	//metric state
	var tokens = metricState.split(",");

	var metricsExecution = new Array(2);
	
	if (tokens.length == 2)
	{
		for(var i in tokens)
		{
			metricsExecution[i] = (tokens[i] === "1")
		}
	}
	else
	{
		throw new InvalidMetricStateError();
	}
	
	//port
	var port = args[2];
	
	
	// Username
	var username = args[3];
	
	username = username.length === 0 ? "" : username;
	username = username === "\"\"" ? "" : username;
	if(username.length === 1 && username === "\"")
		username = "";
	
	// Password
	var passwd = args[4];
	
	passwd = passwd.length === 0 ? "" : passwd;
	passwd = passwd === "\"\"" ? "" : passwd;
	if(passwd.length === 1 && passwd === "\"")
		passwd = "";
		
	
	var requests = []
	
	var request = new Object()
	request.hostname = hostname;
	request.metricsExecution = metricsExecution;
	request.port = port;
	request.username = username;
	request.passwd = passwd;
	
	requests.push(request)
	
	monitorDatabaseAvailability(requests);
	
}




//################### OUTPUT ###########################

function output(metrics)
{
	for(var i in metrics)
	{
		var out = "";
		var metric = metrics[i];
		
		out += metric.id;
		out += "|";
		out += metric.val
		out += "|";
		
		console.log(out);
	}
}


function errorHandler(err)
{
	if(err instanceof InvalidAuthenticationError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else
	{
		console.log(err.message);
		process.exit(1);
	}
}


// ################# MONITOR ###########################
function monitorDatabaseAvailability(requests) 
{
	var mysql = require('mysql');
	
	for(var i in requests)
	{
		var request = requests[i];
		
		var start = Date.now();
		
		var connection = mysql.createConnection({
		  host : request.hostname,
		  port : request.port,
		  user : request.username,
		  password : request.passwd
		});
		
		connection.connect(function(err) 
		{
			if (err && err.code === 'ER_ACCESS_DENIED_ERROR') 
			{
				errorHandler(new InvalidAuthenticationError());
			}
			else if(err)
			{
				processMetricOnError(start, connection)
				return;
			}
			
			connection.query(testQuery, function(err, results) {
				
				if(err)
				{
					processMetricOnError(start, connection);
					return;
				}
				
				processMetricOnSuccess(request, start, connection)
			
			});			
		});
		
	
	}
	
    
}


function processMetricOnError(start, connection)
{
	var metrics = [];
	
	var metric = new Object();
	metric.id = statusId;
	metric.val = 0;
	metric.ts = start;
	metric.exec = Date.now() - start;

	metrics.push(metric);

	output(metrics);
	
	if(connection.state !== 'disconnected' )
		connection.end(function(err) 
		{
			if(err)
			{
				errorHandler(err);
			}
		});
}


function processMetricOnSuccess(request, start, connection)
{
	var metrics = [];
	
	if(request.metricsExecution[0])
	{
		var metric = new Object();
		metric.id = statusId;
		metric.val = 1;
		metric.ts = start;
		metric.exec = Date.now() - start;

		metrics.push(metric);
	}
	
	if(request.metricsExecution[1])
	{
		var metric = new Object();
		metric.id = responseTimeId;
		metric.val = Date.now() - start;
		metric.ts = start;
		metric.exec = Date.now() - start;

		metrics.push(metric);
	}
	
	output(metrics);

	if(connection.state !== 'disconnected' )
		connection.end(function(err) 
		{
			if(err)
			{
				errorHandler(err);
			}
		});
}