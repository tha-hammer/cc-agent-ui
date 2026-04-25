---- MODULE ForkHandlerSlice ----
EXTENDS Integers, Sequences, TLC

CONSTANTS
    N,
    ForkIdx

ASSUME N \in Nat /\ N >= 1
ASSUME ForkIdx \in 1..N

(* --algorithm ForkHandlerSlice

variables
    parentMerged = [i \in 1..N |-> [id |-> i]],
    parentSnapshot = [i \in 1..N |-> [id |-> i]],
    sliceResult = <<>>,
    phase = "init",
    messageIdValid \in {TRUE, FALSE},
    mutationAttempted = FALSE;

define

    SliceUpToAndIncluding ==
        phase = "sliced" =>
            /\ Len(sliceResult) = ForkIdx
            /\ sliceResult[ForkIdx].id = ForkIdx

    ParentImmutable ==
        parentMerged = parentSnapshot

    ReadOnlyAccess ==
        mutationAttempted = FALSE

    AllInvariants ==
        /\ SliceUpToAndIncluding
        /\ ParentImmutable
        /\ ReadOnlyAccess

end define;

fair process handler = "forkHandler"
begin
    InvokeFork:
        if messageIdValid then
            phase := "reading";
        else
            phase := "invalidInput";
            goto Terminate;
        end if;

    ReadParent:
        sliceResult := SubSeq(parentMerged, 1, ForkIdx);
        phase := "sliced";

    Terminate:
        phase := "done";

end process;

end algorithm; *)
\* BEGIN TRANSLATION (chksum(pcal) = "6ff4db89" /\ chksum(tla) = "80cbff1c")
VARIABLES pc, parentMerged, parentSnapshot, sliceResult, phase, 
          messageIdValid, mutationAttempted

(* define statement *)
SliceUpToAndIncluding ==
    phase = "sliced" =>
        /\ Len(sliceResult) = ForkIdx
        /\ sliceResult[ForkIdx].id = ForkIdx

ParentImmutable ==
    parentMerged = parentSnapshot

ReadOnlyAccess ==
    mutationAttempted = FALSE

AllInvariants ==
    /\ SliceUpToAndIncluding
    /\ ParentImmutable
    /\ ReadOnlyAccess


vars == << pc, parentMerged, parentSnapshot, sliceResult, phase, 
           messageIdValid, mutationAttempted >>

ProcSet == {"forkHandler"}

Init == (* Global variables *)
        /\ parentMerged = [i \in 1..N |-> [id |-> i]]
        /\ parentSnapshot = [i \in 1..N |-> [id |-> i]]
        /\ sliceResult = <<>>
        /\ phase = "init"
        /\ messageIdValid \in {TRUE, FALSE}
        /\ mutationAttempted = FALSE
        /\ pc = [self \in ProcSet |-> "InvokeFork"]

InvokeFork == /\ pc["forkHandler"] = "InvokeFork"
              /\ IF messageIdValid
                    THEN /\ phase' = "reading"
                         /\ pc' = [pc EXCEPT !["forkHandler"] = "ReadParent"]
                    ELSE /\ phase' = "invalidInput"
                         /\ pc' = [pc EXCEPT !["forkHandler"] = "Terminate"]
              /\ UNCHANGED << parentMerged, parentSnapshot, sliceResult, 
                              messageIdValid, mutationAttempted >>

ReadParent == /\ pc["forkHandler"] = "ReadParent"
              /\ sliceResult' = SubSeq(parentMerged, 1, ForkIdx)
              /\ phase' = "sliced"
              /\ pc' = [pc EXCEPT !["forkHandler"] = "Terminate"]
              /\ UNCHANGED << parentMerged, parentSnapshot, messageIdValid, 
                              mutationAttempted >>

Terminate == /\ pc["forkHandler"] = "Terminate"
             /\ phase' = "done"
             /\ pc' = [pc EXCEPT !["forkHandler"] = "Done"]
             /\ UNCHANGED << parentMerged, parentSnapshot, sliceResult, 
                             messageIdValid, mutationAttempted >>

handler == InvokeFork \/ ReadParent \/ Terminate

(* Allow infinite stuttering to prevent deadlock on termination. *)
Terminating == /\ \A self \in ProcSet: pc[self] = "Done"
               /\ UNCHANGED vars

Next == handler
           \/ Terminating

Spec == /\ Init /\ [][Next]_vars
        /\ WF_vars(handler)

Termination == <>(\A self \in ProcSet: pc[self] = "Done")

\* END TRANSLATION 
====
