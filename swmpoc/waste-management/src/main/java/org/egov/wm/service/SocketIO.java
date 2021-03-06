package org.egov.wm.service;
//veh track on app
import org.egov.WasteManagementApp;
import org.json.JSONException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import io.socket.client.IO;
import io.socket.client.Socket;
import io.socket.emitter.Emitter;

@Service
public class SocketIO {
	
	public static final Logger logger = LoggerFactory.getLogger(SocketIO.class);

	@Value("${socket.io.host}")
	private String socketHost;
	
	@Value("${socket.io.namespace}")
	private String socketNamespace;
	
	@Value("${socket.default.room}")
	private String socketRoom;
	
	@Autowired
	private WasteManagementApp wasteManagementApp;
	
	@Autowired
	private SocketClient socketClient;
	
	public void pushToSocketIO(String key, String value) throws Exception {    
		logger.info("Pushing to SocketIO.....");
		
/*		IO.Options opts = new IO.Options();
		opts.forceNew = true;
		opts.reconnection = true;
		opts.timeout = 100 * 1000;
		opts.reconnectionAttempts = 1000;
		opts.reconnectionDelay = 0;
		final io.socket.client.Socket socket = IO.socket(socketHost+socketNamespace, opts);*/
		
		final Socket socket = wasteManagementApp.getSocket();
		
		logger.info("socket: "+socket);
		logger.info("\n\n conn-status:"+ socket.connected()+"\n\n");
		
        socket.on(io.socket.client.Socket.EVENT_CONNECT, new Emitter.Listener() {
        @Override
        public void call(Object... args) {
    		logger.info("EVENT_CONNECT");
            try {
                socket.emit(socketRoom, value.toString());
                socketClient.listen();
            } catch (JSONException e) {
            	logger.error("Exception while pushing it to the socket: ",e);
            }
        }

    }).on(io.socket.client.Socket.EVENT_MESSAGE, new Emitter.Listener() {

        @Override
        public void call(Object... args) {
    		logger.info("EVENT_MESSAGE");
            try {
                socket.emit(socketRoom, value.toString());
            } catch (JSONException e) {
            	logger.error("Exception while pushing it to the socket: ",e);
            }
            socketClient.listen();
            logger.info("Message Received: ");
            for (int i = 0; i < args.length; i++) {
            	logger.info(args[i].toString());
            }
        }

    }).on(io.socket.client.Socket.EVENT_DISCONNECT, new Emitter.Listener() {

        @Override
        public void call(Object... args) {
        	logger.info("Client disconnected");
        }

    }).on(io.socket.client.Socket.EVENT_CONNECT_ERROR, new Emitter.Listener() {

        @Override
        public void call(Object... args) {
            Exception e = (Exception) args[0];
        	logger.error("EVENT_CONNECT_ERROR: ",e);
        }

    }).on(io.socket.client.Socket.EVENT_ERROR, new Emitter.Listener() {

        @Override
        public void call(Object... args) {
            Exception e = (Exception) args[0];
        	logger.error("EVENT_ERROR: ",e);
        }

    }).on(io.socket.client.Socket.EVENT_RECONNECT, new Emitter.Listener() {

        @Override
        public void call(Object... args) {
        	logger.info("Reconnecting: ");
            for (int i = 0; i < args.length; i++) {
            	logger.info(args[i].toString());
            }
        }

    }).on("new_message", new Emitter.Listener() {
        @Override
        public void call(Object... args) {
    		logger.info("mesage.event");
            try {
                socket.emit(socketRoom, value.toString());
            } catch (JSONException e) {
            	logger.error("Exception while pushing it to the socket: ",e);
            }
           logger.info("Message Received: ");
            for (int i = 0; i < args.length; i++) {
            	logger.info(args[i].toString());
            }
        }

    });
    socket.connect();
    
	}

}
