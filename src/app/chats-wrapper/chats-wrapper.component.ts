import { Component, Input, OnInit } from '@angular/core';
import { ChatItemComponent } from '../chat-item/chat-item.component';
import { ChatsPageMock } from 'src/mocks/chatsPageMock';
import { IonList } from '@ionic/angular/standalone';
import { NavigationEnd, Router } from '@angular/router';
import { ChatService } from '../socket.service';
import { filter, Subscription } from 'rxjs';
import { FetchesService } from '../fetches.service';
import { ToastService } from '../toast.service';
import { LoadingService } from '../loading.service';
import { ChatNotificationService } from '../chat-notification.service';

@Component({
  selector: 'chats-wrapper',
  templateUrl: './chats-wrapper.component.html',
  styleUrls: ['./chats-wrapper.component.scss'],
  standalone: true,
  imports: [IonList, ChatItemComponent],
})
export class ChatsWrapperComponent implements OnInit {
  @Input() chats: Array<ChatInterface> = [];
  private messageSubscription: Subscription | undefined;

  constructor(
    private router: Router,
    private chatService: ChatService,
    private fetches: FetchesService,
    private toast: ToastService,
    private loadingService: LoadingService,
    private chatNotificationService: ChatNotificationService
  ) {}

  async loadChats() {
    await this.obtainChats(1, false);
  }

  async ngOnInit() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        if (event.url === '/tabs/chats') {
          this.loadChats();
        }
      });

    this.chatNotificationService.chatDeleted$.subscribe(() => {
      this.loadChats();
    });

    this.chatService.connect();

    this.messageSubscription = this.chatService
      .listenForIncomingMessages()
      .subscribe((message: any) => {
        const chatIndex = this.chats.findIndex(
          (chat) => chat.idUserReceiver === message.sender
        );

        if (chatIndex !== -1) {
          this.chats[chatIndex].lastMessageContent = {
            idUserSender: message.sender,
            message: message.message,
            date: message.date,
            read: false,
            id: crypto.getRandomValues(new Uint32Array(1))[0].toString(),
          };
        } else {
          this.obtainChats();
        }
      });

    this.chatService.outgoingMessages.subscribe((message: any) => {
      const chatIndex = this.chats.findIndex(
        (chat) => chat.idUserReceiver === message.receiver
      );

      // console.log(message)

      if (chatIndex !== -1) {
        this.chats[chatIndex].lastMessageContent = {
          idUserSender: message.sender,
          message: message.message,
          date: new Date().toISOString(),
          read: false,
          id: crypto.getRandomValues(new Uint32Array(1))[0].toString(),
        };

        // console.log(this.chats[chatIndex]);
      } else {
        this.obtainChats(1, false);
      }
    });

    await this.obtainChats();
  }

  async obtainChats(page = 1, loading = true) {
    try {
      const chats = (await this.fetches.obtainChats(
        page,
        loading
      )) as Array<ChatInterface>;

      if (chats.length === 0 || !chats) {
        this.chats = [];
      }

      const sortedChats = this.sortChatsByDate(chats);
      this.chats = sortedChats;
    } catch (error) {
      console.error(error);
      this.toast.showToast({
        message: 'Error al obtener chats',
        type: 'danger',
      });
      this.chats = [];
    } finally {
      this.loadingService.hideLoading();
    }
  }

  private sortChatsByDate(chats: Array<ChatInterface>) {
    return chats.sort((a, b) => {
      return (
        new Date(b.lastMessageContent.date).getTime() -
        new Date(a.lastMessageContent.date).getTime()
      );
    });
  }

  goToUserChat(idUserReceiver: string, idChat: string) {
    this.router.navigate(['/chat', idUserReceiver, idChat]);
  }

  ngOnDestroy() {
    this.chatService.disconnect();
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
  }
}

interface ChatInterface {
  idUser: string;
  idUserReceiver: string;
  id: string;
  lastMessageContent: LastMessageContent;
  userLastMessage: UserLastMessage;
  userReceiver: UserLastMessage;
}

interface UserLastMessage {
  userName: string;
  image: string;
  id: string;
}

interface LastMessageContent {
  idUserSender: string;
  message: Content;
  date: string;
  read: boolean;
  id: string;
}

interface Content {
  type: string;
  content: string;
}
