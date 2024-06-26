import { v4 } from "https://deno.land/std@0.58.0/uuid/mod.ts";
import { isWebSocketCloseEvent } from "https://deno.land/std@0.58.0/ws/mod.ts";
const usersMap= new Map();
const groupsMap = new Map();
const messagesMap= new Map();

export default async function chat(ws){
    console.log(`Connected`);
    const userId= v4.generate();
    
    for await (let data of ws){
        console.log(data, typeof data);
        const event= typeof data==='string'? JSON.parse(data): data;


        if(isWebSocketCloseEvent(data)){
            const userObj= usersMap.get(userId);
            let users= groupsMap.get(userObj.groupName) || []; 
            users= users.filter(u =>u.userId !== userId);
            groupsMap.set(userObj.groupName,users);

            usersMap.delete(userId);
            emitUserList(userObj.groupName);
            break;
        }
        let userObj;
        switch(event.event){
            case 'join':
                userObj={
                    userId,
                    name: event.name,
                    groupName: event.groupName,
                    ws
                }
                usersMap.set(userId,userObj);
                const users= groupsMap.get(event.groupName) || [];
                users.push(userObj);
                groupsMap.set(event.groupName,users);

                emitUserList(event.groupName); //announce all users in the chatroom that new user has joined
                emitPreviousMessages(event.groupName, ws)
                break;
            case 'message':
                userObj = usersMap.get(userId);
                const message={
                    userId,
                    name: userObj.name,
                    message: event.data
                }
                const messages=messagesMap.get(userObj.groupName) || [];
                messages.push(message);
                messagesMap.set(userObj.groupName, messages);
                emitMessage(userObj.groupName,message, userId)

        }
    }
}


function emitUserList(groupName){
    const users= groupsMap.get(groupName) || [];
    for(const user of users){
        const event={
            event:'users',
            data: getDisplayUsers(groupName)
        }
        user.ws.send(JSON.stringify(event))
    }
}

function getDisplayUsers(groupName){
    const users= groupsMap.get(groupName) || [];
    return users.map(u =>{
        return {userId: u.userId, name:u.name}
    })
}

function emitMessage(groupName,message,senderId){
    const users= groupsMap.get(groupName) || [];
    for(const user of users){
        console.log(`user: ${user.name}`);
        message.sender = user.userId === senderId ? 'me' : senderId
        const event={
            event:'message',
            data: message
        }
        user.ws.send(JSON.stringify(event))
    }
}

function emitPreviousMessages(groupName,ws){
    const messages= messagesMap.get(groupName) || [];
    const event = {
        event: 'previousMessages',
        data: messages
    }
    ws.send(JSON.stringify(event));
}