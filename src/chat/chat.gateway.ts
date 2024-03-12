import { Server, Socket } from 'socket.io';
import { OnModuleInit } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';

import { ChatService } from './chat.service';

@WebSocketGateway()
export class ChatGateway implements OnModuleInit {

  @WebSocketServer()
  public server: Server;

  constructor(private readonly chatService: ChatService) {}

  onModuleInit() {

    this.server.on('connection', ( socket: Socket ) => {
      
      const { name, token } = socket.handshake.auth;
      console.log(name, token);
      if( !name ){
        socket.disconnect();
      }

      this.chatService.onClientConnected({ id: socket.id, name: name })
      socket.emit('welcome-message', 'Bienvenido al servidor')

      // Listado de usuarios conectados
      this.server.emit('on-clients-changed', this.chatService.getClients() );
      
      socket.on('disconnect', () => {
        this.chatService.onClientDisconnected( socket.id );
        this.server.emit('on-clients-changed', this.chatService.getClients() );
        // console.log('Cliente desconectado: ', socket.id);
      });
    });

  }

  @SubscribeMessage('send-message')
  handleMessage(
    @MessageBody() message: string,
    @ConnectedSocket() client: Socket,
  ) {

    const { name } = client.handshake.auth;

    if( !message ) {
      return;
    }

    this.server.emit('on-message', {
      userId: client.id,
      message: message,
      name: name,
    })
    
  }

  @SubscribeMessage('send-private-message')
  handlePrivateMessage(
    @MessageBody() { recipientId, message }: { recipientId: string, message: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { name } = client.handshake.auth;
    
    if( !message ) {
      return;
    }
    
    const recipientClient = this.server.sockets.sockets.get(recipientId);
    console.log(`Mensaje enviado de: ${ name } para el id ${ recipientId }`);
    if (recipientClient) {
      
      recipientClient.emit('private-message', { 
        userId: client.id, 
        message: message, 
        name: name 
      });
    } else {
      client.emit('error', 'El destinatario no está conectado');
    }
  }

}
