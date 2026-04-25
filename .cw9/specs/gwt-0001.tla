---- MODULE ForkPanePassesIndexAndOnFork ----

EXTENDS Integers, Sequences, TLC

CONSTANTS
    MessageCount,
    OnForkRef,
    OtherPropVal

\* CFG entries (each invariant independently checkable):
\* SPECIFICATION Spec
\* CONSTANT MessageCount = 3
\* CONSTANT OnForkRef = "onForkRef"
\* CONSTANT OtherPropVal = "otherPropVal"
\* INVARIANT IndexFidelity
\* INVARIANT CallbackIdentity
\* INVARIANT PropAdditivity
\* INVARIANT NoSideEffects
\* INVARIANT ChildCountComplete

(* --algorithm ForkPanePassesIndexAndOnFork

variables
    visibleMessages = [i \in 1..MessageCount |-> [id |-> i, content |-> "msg"]],
    renderedChildren = <<>>,
    currentIndex = 0,
    paneRendered = FALSE;

define

    IndexFidelity ==
        \A i \in 1..Len(renderedChildren) :
            renderedChildren[i].messageIndex = i - 1

    CallbackIdentity ==
        \A i \in 1..Len(renderedChildren) :
            renderedChildren[i].onFork = OnForkRef

    PropAdditivity ==
        \A i \in 1..Len(renderedChildren) :
            /\ renderedChildren[i].message = visibleMessages[i]
            /\ renderedChildren[i].otherProp = OtherPropVal

    NoSideEffects ==
        visibleMessages = [i \in 1..MessageCount |-> [id |-> i, content |-> "msg"]]

    ChildCountComplete ==
        paneRendered => Len(renderedChildren) = MessageCount

    AllInvariants ==
        /\ IndexFidelity
        /\ CallbackIdentity
        /\ PropAdditivity
        /\ NoSideEffects
        /\ ChildCountComplete

end define;

fair process renderer = "ChatMessagesPane"
begin
    RenderPane:
        while currentIndex < MessageCount do
            renderedChildren := Append(
                renderedChildren,
                [ messageIndex |-> currentIndex,
                  onFork       |-> OnForkRef,
                  message      |-> visibleMessages[currentIndex + 1],
                  otherProp    |-> OtherPropVal ]
            );
            currentIndex := currentIndex + 1;
        end while;
    Finish:
        paneRendered := TRUE;
end process;

end algorithm; *)
\* BEGIN TRANSLATION (chksum(pcal) = "94ae8c79" /\ chksum(tla) = "41d1068")
VARIABLES pc, visibleMessages, renderedChildren, currentIndex, paneRendered

(* define statement *)
IndexFidelity ==
    \A i \in 1..Len(renderedChildren) :
        renderedChildren[i].messageIndex = i - 1

CallbackIdentity ==
    \A i \in 1..Len(renderedChildren) :
        renderedChildren[i].onFork = OnForkRef

PropAdditivity ==
    \A i \in 1..Len(renderedChildren) :
        /\ renderedChildren[i].message = visibleMessages[i]
        /\ renderedChildren[i].otherProp = OtherPropVal

NoSideEffects ==
    visibleMessages = [i \in 1..MessageCount |-> [id |-> i, content |-> "msg"]]

ChildCountComplete ==
    paneRendered => Len(renderedChildren) = MessageCount

AllInvariants ==
    /\ IndexFidelity
    /\ CallbackIdentity
    /\ PropAdditivity
    /\ NoSideEffects
    /\ ChildCountComplete


vars == << pc, visibleMessages, renderedChildren, currentIndex, paneRendered
        >>

ProcSet == {"ChatMessagesPane"}

Init == (* Global variables *)
        /\ visibleMessages = [i \in 1..MessageCount |-> [id |-> i, content |-> "msg"]]
        /\ renderedChildren = <<>>
        /\ currentIndex = 0
        /\ paneRendered = FALSE
        /\ pc = [self \in ProcSet |-> "RenderPane"]

RenderPane == /\ pc["ChatMessagesPane"] = "RenderPane"
              /\ IF currentIndex < MessageCount
                    THEN /\ renderedChildren' =                     Append(
                                                    renderedChildren,
                                                    [ messageIndex |-> currentIndex,
                                                      onFork       |-> OnForkRef,
                                                      message      |-> visibleMessages[currentIndex + 1],
                                                      otherProp    |-> OtherPropVal ]
                                                )
                         /\ currentIndex' = currentIndex + 1
                         /\ pc' = [pc EXCEPT !["ChatMessagesPane"] = "RenderPane"]
                    ELSE /\ pc' = [pc EXCEPT !["ChatMessagesPane"] = "Finish"]
                         /\ UNCHANGED << renderedChildren, currentIndex >>
              /\ UNCHANGED << visibleMessages, paneRendered >>

Finish == /\ pc["ChatMessagesPane"] = "Finish"
          /\ paneRendered' = TRUE
          /\ pc' = [pc EXCEPT !["ChatMessagesPane"] = "Done"]
          /\ UNCHANGED << visibleMessages, renderedChildren, currentIndex >>

renderer == RenderPane \/ Finish

(* Allow infinite stuttering to prevent deadlock on termination. *)
Terminating == /\ \A self \in ProcSet: pc[self] = "Done"
               /\ UNCHANGED vars

Next == renderer
           \/ Terminating

Spec == /\ Init /\ [][Next]_vars
        /\ WF_vars(renderer)

Termination == <>(\A self \in ProcSet: pc[self] = "Done")

\* END TRANSLATION 

====
