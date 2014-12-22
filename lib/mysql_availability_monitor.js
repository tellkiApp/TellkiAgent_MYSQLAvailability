//node mysql_availability_monitor 192.168.69.3 1446 "1,1" 3306 "xpto" "xpto"


var statusId = "123:9";
var responseTimeId = "26:4";
var testQuery = "SELECT CURDATE();";

//####################### EXCEPTIONS ################################

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = ("Wrong number of parameters.");
}
InvalidParametersNumberError.prototype = Error.prototype;

function InvalidMetricStateError() {
    this.name = "InvalidMetricStateError";
    this.message = ("Invalid number of metrics.");
}
InvalidMetricStateError.prototype = Error.prototype;

function InvalidAuthenticationError() {
    this.name = "InvalidAuthenticationError";
    this.message = ("Invalid authentication.");
}
InvalidAuthenticationError.prototype = Error.prototype;

// ############# INPUT ###################################

(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		console.log(err.message);
		process.exit(1);
	}
}).call(this)



function monitorInput(args)
{
	
	if(args.length == 6 || args.length == 7)
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
	
	//target
	var targetUUID = args[1];
	
	//metric state
	var metricState = args[2].replace("\"", "");
	
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
	var port = args[3];
	
	
	// Username
	var username = args[4];
	username = username.length === 0 ? "" : username;
	
	// Password
	var passwd = args[5];
	passwd = passwd.length === 0 ? "" : passwd;
	
	
	if(args.length == 7)
	{
		var serviceName = args[6];
	}
	
	var requests = []
	
	var request = new Object()
	request.hostname = hostname;
	request.targetUUID = targetUUID;
	request.metricsExecution = metricsExecution;
	request.port = port;
	request.username = username;
	request.passwd = passwd;
	
	if(serviceName !== undefined)
	{
		request.serviceName = serviceName;
	}
	
	requests.push(request)

	//console.log(JSON.stringify(requests));
	
	monitorDatabaseAvailability(requests);
	
}




//################### OUTPUT ###########################

function output(metrics, targetId)
{
	for(var i in metrics)
	{
		var out = "";
		var metric = metrics[i];
		
		out += new Date(metric.ts).toISOString();
		out += "|";
		out += metric.id;
		out += "|";
		out += targetId;
		out += "|";
		out += metric.val
		out += "\n";
	}
	
	console.log(out);
}


function errorHandler(err)
{
	if(err)
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
				processMetricOnError(request, start, connection)
				return;
			}
			
			//console.log('connected as id ' + connection.threadId);
			
			connection.query(testQuery, function(err, results) {
				
				if(err)
				{
					processMetricOnError(request, start, connection);
					return;
				}
				
				processMetricOnSuccess(request, start, connection, results)
			
			});			
		});
		
	
	}
	
    
}


function processMetricOnError(request, start, connection)
{
	var metrics = [];
	
	var metric = new Object();
	metric.id = statusId;
	metric.val = 0;
	metric.ts = start;
	metric.exec = Date.now() - start;

	metrics.push(metric);

	output(metrics, request.targetUUID);
	
	if(connection.state !== 'disconnected' )
		connection.end(function(err) 
		{
			if(err)
			{
				errorHandler(err);
			}
		});
}


function processMetricOnSuccess(request, start, connection, response)
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
	
	output(metrics, request.targetUUID);

	if(connection.state !== 'disconnected' )
		connection.end(function(err) 
		{
			if(err)
			{
				errorHandler(err);
			}
			//console.log("conn closed");
		});
}