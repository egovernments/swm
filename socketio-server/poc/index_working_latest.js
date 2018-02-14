var ontime = require('ontime');
var moment = require('moment');
var socketio = require('socket.io');
var fs = require('fs');
var http = require('http');
// var appmetrics = require("appmetrics");
// var dash = require("appmetrics-dash").monitor();
var http = require('http')

var io = socketio.listen(3005);

// creating namespaces
var location_nsp = io.of('/location');
// var custom_event_nsp = io.of('/customevent');
// var custom_alert_namespace = io.of('/customAlert');
// var system_event_namespace = io.of('/systemEvent');
 var eda_namespace = io.of('/eda');
 var supervised_namespace = io.of('/supervised');
 var unsupervised_namespace = io.of('/unsupervised');

var workbench_namespace = io.of('/workbench');

var PARTNER_DICT = {}

var GLOBAL_PARAMS = { "overall_distance":0 , "retailers_visited":0};

//for storing movement in km for every user
var movement_in_km = {};
var retailers_visited = {};



//for storing data as key-value pair like { "customerID1": [[.....],[.......]], "customerID2": [[.......],[.....]] }
var whole_day_data = {};

// for storing latest data for all customers like { "customer_ID1": [] ,........ "customer_ID10": []....}
var latest_data_for_all = {};

//array for storing names
var customer_info = {};

location_nsp.on('connection', function(socket) {

    //on connection emit latest data to client for all customers
    socket.emit('customer_list', latest_data_for_all);
    socket.emit('global_params',GLOBAL_PARAMS);
    socket.emit('customer_names',JSON.stringify(customer_info))

    console.log("new user connected");

    //joining rooms
    socket.on('room', function(room) {
        //when selecting one customerID , we add that client to the customer's room and also send json for that customer

        socket.join(room);
        console.log("Joined room :- " + room)
        // sending whole day data to that socket to draw heatmap and polyline
        //socket.broadcast.to(socket).emit('customer_data', whole_day_data[room]);
        socket.emit('customer_data', whole_day_data[room]);
        if (room in retailers_visited){
        socket.emit('retailers_visit_customer',retailers_visited[room]);
        }
        //location_nsp.in(room).emit('customer_data', whole_day_data[room]);
    });

    socket.on('leave_room', function(room) {
        //back button pressed , let client leave the room
        console.log("Left room :- " + room);
        socket.leave(room);
    })

    socket.on('custom_event', function(data) {

        console.log("Custom event");
        console.log(data);

    })
    
    socket.on('reset_server_data',function (data) {
        whole_day_data = {};
        latest_data_for_all={};
    })
    
    socket.on('movement_km',function (data) {
        
        //maintaining distance for each customer
        //console.log(data);
        if (data[0] in movement_in_km) {
            movement_in_km[data[0]]=movement_in_km[data[0]]+data[1];
            GLOBAL_PARAMS["overall_distance"] = GLOBAL_PARAMS["overall_distance"]+data[1]

            location_nsp.emit('global_params',GLOBAL_PARAMS);
        } else {
            movement_in_km[data[0]]=data[1];
            GLOBAL_PARAMS["overall_distance"] = GLOBAL_PARAMS["overall_distance"]+data[1]
            location_nsp.emit('global_params',GLOBAL_PARAMS);


        }
        
    })
    
    
    socket.on('retailers_visited',function (retailer_visited_list) {
        for (var i = 0; i < retailer_visited_list.length ; i++) {
            data=retailer_visited_list[i];
        
        if (data[0] in retailers_visited) {
                if (arrayContains(data[1], retailers_visited[data[0]])){
                    
                }else {
                    re_arr = retailers_visited[data[0]];
                    re_arr.push(data[1]);
                    retailers_visited[data[0]] = re_arr;
                    GLOBAL_PARAMS["retailers_visited"] = GLOBAL_PARAMS["retailers_visited"] + 1;
                    location_nsp.emit('global_params',GLOBAL_PARAMS);

                }
        }else {
            retailers_visited[data[0]] = [data[1]]
            GLOBAL_PARAMS["retailers_visited"] = GLOBAL_PARAMS["retailers_visited"] + 1;
            location_nsp.emit('global_params',GLOBAL_PARAMS);


            
        }}
       
    })


    socket.on('data', function(data) {

        // parse the string into a list of lists
        console.log('Messages received :- ' + data.length);

        //iterate over the list 
        for (var i = 0; i < data.length; i++) {
            var parsedData = data[i];
            if (parsedData[4]=='null') {
                if(parsedData[0] in latest_data_for_all){
                last_data=latest_data_for_all[parsedData[0]];
                last_data[4]=null;
                last_data[1]=parsedData[1];
                location_nsp.in(parsedData[0]).emit('latest_data', last_data);
                whole_day_data[parsedData[0]].push(last_data);
                latest_data_for_all[parsedData[0]] = last_data;
                }
            }else {
                //first check if customerID from this data is already a key in that whole_day_data structure , if yes then append this data to that customerID list
                if (parsedData[0] in whole_day_data) {
                    whole_day_data[parsedData[0]].push(parsedData);
                } else {
                    //if no key present for that customer, make a new key value pair with JSON in the list
                    
                    http.get('http://proogle.ml:4098/customerInfo?customer_id='+parsedData[0], (resp) => {
                        var data = '';
                     
                        // A chunk of data has been recieved.
                        resp.on('data', (chunk) => {
                            data += chunk;
                        });
                     
                        // The whole response has been received. Print out the result.
                        resp.on('end', () => {
                            customer_info[parsedData[0]] = JSON.parse(data).name;
                            location_nsp.emit('customer_names',JSON.stringify(customer_info));
                        });
                     
                    }).on("error", (err) => {
                        console.log("Error: " + err.message);
                    });
                    
                    whole_day_data[parsedData[0]] = [parsedData];
                    

                }

                //keep updating the latest data for each customer
                latest_data_for_all[parsedData[0]] = parsedData;
                //also send the real-time data to the correct room
                location_nsp.in(parsedData[0]).emit('latest_data', parsedData);
            }
        }

        //checking if data has come for new customers, then send data  to each connected client for updating their table
        location_nsp.emit('customer_list', latest_data_for_all);

    });
});




workbench_namespace.on('connection', function(socket) {
    socket.emit('hello', "Connected to namespace :- Workbench");
    socket.on('room', function(room) {
        socket.join(room);
        console.log("Joined room :- " + room)
    })
    socket.on('leave_room', function(room) {
        //back button pressed , let client leave the room
        console.log("Left room :- " + room);
        socket.leave(room);
    })
    socket.on('data', function(msg, ack_fn) {     
        console.log('Message Received for wokbench: ', msg);     
        workbench_namespace.in(msg.room).emit('latest_data', msg.msg);
    });

});


// io.on('connection', function(socket) {
//     socket.on('message', function(msg) {     
//         console.log('Message Received: ', msg);     
//         socket.emit('message2', msg);
//     });
// });

eda_namespace.on('connection', function(socket) {
    socket.emit('hello', "Connected to namespace :- EDA");
    socket.on('data', function(msg, ack_fn) {     
        console.log('Message Received for eda: ', msg);     
        eda_namespace.emit('data', msg);
    });
});

supervised_namespace.on('connection', function(socket) {
    socket.emit('hello', "Connected to namespace :- EDA");
    socket.on('data', function(msg, ack_fn) {     
        console.log('Message Received for supervised: ', msg);     
        supervised_namespace.emit('data', msg);
    });
});

unsupervised_namespace.on('connection', function(socket) {
    socket.emit('hello', "Connected to namespace :- EDA");
    socket.on('data', function(msg, ack_fn) {     
        console.log('Message Received for unsupervised: ', msg);     
        unsupervised_namespace.emit('data', msg);

    });
});

// system_event_namespace.on('connection', function(socket) {
//     socket.emit('hello', "Connected to namespace :- system events")
//     socket.on('marketStatus', function(msg, ack_fn) {
//         ack_fn(true);
//         console.log("marketStatus:- " + msg);
//         socket.broadcast.emit('data', msg);
//     })
// });

// custom_alert_namespace.on('connection', function(socket) {
//     socket.emit('hello', "Connected to namespace :- custom alerts");

//     socket.on('tip', function(msg, ack_fn) {
//         ack_fn(true);
//         socket.broadcast.emit('tip', msg);
//     })

//     socket.on('promotion', function(msg, ack_fn) {
//         ack_fn(true);
//         socket.broadcast.emit('promotion', msg);
//     })

// });

//used to refresh data every midnight
ontime({
    cycle: ['18:30:00'],
    utc: true
}, function(ot) {
    whole_day_data = {};
    latest_data_for_all={};
    movement_in_km = {};
    retailers_visited = {};
    GLOBAL_PARAMS = { "overall_distance":0 , "retailers_visited":0};
    whole_day_data = {};
    latest_data_for_all={};
    movement_in_km = {};
    retailers_visited = {};
    GLOBAL_PARAMS = { "overall_distance":0 , "retailers_visited":0};
    ot.done()
    return
})

function arrayContains(needle, arrhaystack)
{
    return (arrhaystack.indexOf(needle) > -1);
}