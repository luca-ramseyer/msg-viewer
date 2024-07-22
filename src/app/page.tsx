"use client"

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import MsgReader from "@kenjiuno/msgreader";
import { useState } from "react";

interface Message {
  subject: string;
  senderName: string;
  senderEmail: string;
  recipients: Recipient[];
  body: string;
  attachments: Attachment[];
}

interface Recipient {
  name: string;
  email: string;
}

interface Attachment {
  dataId: number;
  contentLength: number;
  fileName: string;
  fileNameShort: string;
} 

export default function HomePage() {
  const [msgData, setMsgData] = useState<Message | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const getInitials = (name: string) => {
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];
    return (firstName!.charAt(0) + lastName!.charAt(0)).toUpperCase();
  };

  const handleSubmit = (e : React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result;
        if(arrayBuffer instanceof ArrayBuffer) {
          const msgReader = new MsgReader(arrayBuffer);
          const tempMsgData = msgReader.getFileData();
          console.log(tempMsgData);

          setMsgData({
            subject: tempMsgData.subject,
            senderName: tempMsgData.senderName,
            senderEmail: tempMsgData.senderSmtpAddress,
            recipients: tempMsgData.recipients,
            body: tempMsgData.body,
            attachments: tempMsgData.attachments,
          } as Message)
        }
      }
      reader.readAsArrayBuffer(file);
    }
  }

  const handleFileUpload = (event : React.ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files![0]!)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground gap-12 py-36">
      <Card className="max-w-full mx-32 flex flex-col items-center justify-center gap-4 pt-10">
        <h1 className="text-4xl">.msg file reader</h1>
        <form onSubmit={handleSubmit} className="w-96 flex flex-col items-center justify-center gap-4 p-6">
          <Input className="border-border bg-card" type="file" accept=".msg" onChange={handleFileUpload} />
          <Button className="w-full" type="submit">Submit</Button>
        </form>
      </Card>
        {
          msgData && (
            <Card className="max-w-full mx-32 p-12 flex flex-col gap-4">
              <h1 className="text-2xl">{msgData.subject}</h1>
              <div className="flex flex-row gap-4">
                <div className="flex flex-col items-center justify-center p-2 rounded-full bg-primary h-12 w-12 text-primary-foreground">
                  <h2 className="text-xl">{getInitials(msgData.senderName)}</h2>
                </div>
                <div>
                  <h2 className="text-xl">{msgData.senderName} {msgData.senderEmail}</h2>
                  <p className="text-sm">To {msgData.recipients.map((recipient) => recipient.name).join(", ")}</p>
                </div>
              </div>
              <div dangerouslySetInnerHTML={{ __html: msgData.body }} />
            </Card>
          )
        }
    </main>
  );
}